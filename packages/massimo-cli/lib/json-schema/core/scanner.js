import { createNameRegistry } from './name-registry.js'
import { getDefaultRootName, joinTypeName, normalizeTypeName, singularizeTypeName } from './naming.js'
import { getSchemaAtPath, toRefPath } from './pointer.js'

export function scanJSONSchema ({ schema, rootName = undefined }) {
  const state = createScanState({ schema, rootName })

  traverseSchema({
    schema,
    path: '#',
    suggestedName: state.rootName,
    state
  })

  registerReferencedSchemas({ state })
  registerReferenceAliases({ state })

  return state
}

export function createScanState ({ schema, rootName = undefined }) {
  return {
    rootSchema: schema,
    rootName: getDefaultRootName({ schema, rootName }),
    nameRegistry: createNameRegistry(),
    schemasByPath: new Map([['#', schema]]),
    aliasTargetByPath: new Map(),
    aliasSourceSchemaByPath: new Map(),
    references: new Set(),
    expandedReferencePaths: new Set(),
    refByPath: new Map()
  }
}

function traverseSchema ({ schema, path, suggestedName, state }) {
  if (!isSchemaObject(schema)) {
    return
  }

  state.schemasByPath.set(path, schema)

  const name = getRegisteredName({ schema, path, suggestedName, state })

  if (schema.$ref) {
    state.references.add(schema.$ref)
    if (!state.refByPath.has(path)) {
      state.refByPath.set(path, schema.$ref)
    }
    if (isNestedPropertyPath(path) && !shouldExpandNestedReference({
      path,
      targetPath: toRefPath(schema.$ref)
    })) {
      return
    }
    expandReferenceSchema({
      ref: schema.$ref,
      path,
      suggestedName: name || suggestedName,
      state
    })
    return
  }

  traverseProperties({ schema, path, parentName: name || suggestedName, state })
  traverseItems({ schema, path, parentName: name || suggestedName, state })
  traverseAdditionalProperties({ schema, path, parentName: name || suggestedName, state })
  traverseCombinators({ schema, path, parentName: name || suggestedName, state })
  traverseDefinitions({ schema, path, state })
}

export function getScannedSchemaAtPath ({ path, state }) {
  return state.schemasByPath.get(path) || getSchemaAtPath({ schema: state.rootSchema, path })
}

export function getAliasTargetName ({ path, state }) {
  return state.aliasTargetByPath?.get(path) || null
}

export function getAliasSourceSchema ({ path, state }) {
  return state.aliasSourceSchemaByPath?.get(path) || null
}

export function hasReferenceAtPath ({ path, state }) {
  return state.refByPath?.has(path) || false
}

export function shouldInlineArrayPropertyType ({ path, schema, state }) {
  if (!isPropertyPath(path) || !isArraySchema({ schema }) || hasReferenceAtPath({ path, state })) {
    return false
  }

  if (!isDirectPropertyPath(path) && !isSimpleArrayItemSchema({ schema: schema.items })) {
    return false
  }

  return state.nameRegistry.hasPathName({ path: `${path}/items` })
}

export function shouldInlineNamedScalarPropertyType ({ path, schema, state }) {
  if (
    !isPropertyPath(path) ||
    !isUnionBranchPropertyPath(path) ||
    hasReferenceAtPath({ path, state }) ||
    !isInlineFormattedScalarSchema({ schema })
  ) {
    return false
  }

  const parentPath = path.replace(/\/properties\/[^/]+$/, '')
  const parentName = state.nameOverrides?.get(parentPath) || state.nameRegistry.getPathName({ path: parentPath })
  if (!parentName) {
    return false
  }

  const propertyName = path.slice(path.lastIndexOf('/') + 1)
  return parentName.endsWith(normalizeTypeName(propertyName))
}

function traverseDefinitions ({ schema, path, state }) {
  for (const [containerName, definitions] of Object.entries({
    definitions: schema.definitions,
    $defs: schema.$defs
  })) {
    if (!isSchemaObject(definitions)) {
      continue
    }

    for (const [key, definitionSchema] of Object.entries(definitions)) {
      traverseSchema({
        schema: definitionSchema,
        path: `${path}/${containerName}/${key}`,
        suggestedName: normalizeTypeName(key),
        state
      })
    }
  }
}

function traverseProperties ({ schema, path, parentName, state }) {
  if (!isSchemaObject(schema.properties)) {
    return
  }

  for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
    const suggestedName = path === '#'
      ? normalizeTypeName(propertyName)
      : joinTypeName({ prefix: parentName, suffix: propertyName })

    traverseSchema({
      schema: propertySchema,
      path: `${path}/properties/${propertyName}`,
      suggestedName,
      state
    })
  }
}

function traverseItems ({ schema, path, parentName, state }) {
  if (!schema.items) {
    return
  }

  if (Array.isArray(schema.items)) {
    for (const [index, itemSchema] of schema.items.entries()) {
      traverseSchema({
        schema: itemSchema,
        path: `${path}/items/${index}`,
        suggestedName: joinTypeName({ prefix: parentName, suffix: `Item${index + 1}` }),
        state
      })
    }

    return
  }

  const suggestedName = getArrayItemSuggestedName({ schema: schema.items, path, parentName })

  traverseSchema({
    schema: schema.items,
    path: `${path}/items`,
    suggestedName,
    state
  })
}

function traverseAdditionalProperties ({ schema, path, parentName, state }) {
  if (!isSchemaObject(schema.additionalProperties)) {
    return
  }

  traverseSchema({
    schema: schema.additionalProperties,
    path: `${path}/additionalProperties`,
    suggestedName: joinTypeName({ prefix: parentName, suffix: 'Value' }),
    state
  })
}

function traverseCombinators ({ schema, path, parentName, state }) {
  traverseCombinatorMembers({
    members: schema.oneOf,
    path,
    parentName,
    kind: 'Option',
    keyword: 'oneOf',
    state
  })

  traverseCombinatorMembers({
    members: schema.anyOf,
    path,
    parentName,
    kind: 'Option',
    keyword: 'anyOf',
    state
  })

  traverseCombinatorMembers({
    members: schema.allOf,
    path,
    parentName,
    kind: 'Part',
    keyword: 'allOf',
    state
  })
}

function traverseCombinatorMembers ({ members, path, parentName, kind, keyword, state }) {
  if (!Array.isArray(members)) {
    return
  }

  for (const [index, memberSchema] of members.entries()) {
    traverseSchema({
      schema: memberSchema,
      path: `${path}/${keyword}/${index}`,
      suggestedName: getCombinatorSuggestedName({ memberSchema, parentName, kind, index }),
      state
    })
  }
}

function registerReferencedSchemas ({ state }) {
  for (const reference of state.references) {
    const path = toRefPath(reference)
    if (!path.startsWith('#') || state.nameRegistry.hasPathName({ path })) {
      continue
    }

    const targetSchema = getSchemaAtPath({ schema: state.rootSchema, path })
    if (!isSchemaObject(targetSchema)) {
      continue
    }

    const fallbackName = getFallbackNameFromPath({ path })
    getRegisteredName({
      schema: targetSchema,
      path,
      suggestedName: fallbackName,
      state
    })
  }
}

function expandReferenceSchema ({ ref, path, suggestedName, state }) {
  const refPath = toRefPath(ref)
  const expansionKey = `${path}=>${refPath}`
  if (state.expandedReferencePaths.has(expansionKey)) {
    return
  }

  state.expandedReferencePaths.add(expansionKey)

  const targetSchema = getSchemaAtPath({ schema: state.rootSchema, path: refPath })
  if (!isSchemaObject(targetSchema)) {
    return
  }

  traverseSchema({
    schema: targetSchema,
    path,
    suggestedName,
    state
  })
}

function registerReferenceAliases ({ state }) {
  for (const [path, ref] of state.refByPath.entries()) {
    if (!state.nameRegistry.hasPathName({ path })) {
      continue
    }

    const aliasTargetName = resolveReferenceTargetName({ path, ref, state })
    if (!aliasTargetName) {
      continue
    }

    const localName = state.nameRegistry.getPathName({ path })
    if (localName !== aliasTargetName) {
      state.aliasTargetByPath.set(path, aliasTargetName)
    }

    const sourceSchema = getSchemaAtPath({ schema: state.rootSchema, path: toRefPath(ref) })
    if (isSchemaObject(sourceSchema)) {
      state.aliasSourceSchemaByPath.set(path, sourceSchema)
    }
  }
}

function resolveReferenceTargetName ({ path, ref, state, visitedRefs = new Set() }) {
  const refPath = toRefPath(ref)
  if (visitedRefs.has(refPath)) {
    return state.nameRegistry.getPathName({ path: refPath }) || null
  }

  visitedRefs.add(refPath)

  const isWithinBoundary = isPathWithinBoundary({
    path: refPath,
    boundaryPath: getReferenceBoundaryPath({ path })
  })
  const nestedRef = state.refByPath.get(refPath)

  if (isWithinBoundary) {
    if (!nestedRef) {
      return null
    }

    const nestedTargetName = resolveReferenceTargetName({
      path,
      ref: nestedRef,
      state,
      visitedRefs
    })
    return nestedTargetName || null
  }

  const aliasTargetName = state.aliasTargetByPath.get(refPath)
  if (aliasTargetName) {
    return aliasTargetName
  }

  if (nestedRef) {
    const nestedTargetName = resolveReferenceTargetName({
      path,
      ref: nestedRef,
      state,
      visitedRefs
    })
    if (nestedTargetName) {
      return nestedTargetName
    }
  }

  return state.nameRegistry.getPathName({ path: refPath }) || null
}

function getRegisteredName ({ schema, path, suggestedName, state }) {
  if (state.nameRegistry.hasPathName({ path })) {
    const existingName = state.nameRegistry.getPathName({ path })
    registerStructureName({ schema, name: existingName, state })
    return existingName
  }

  const resolvedName = resolveScanName({ schema, path, suggestedName, state })
  if (!resolvedName) {
    return null
  }

  const reuseKey = getSchemaReuseKey({ schema })
  if (reuseKey && isDefinitionPath(path) && state.nameRegistry.hasStructureName({ key: reuseKey })) {
    const aliasTargetName = state.nameRegistry.getStructureName({ key: reuseKey })
    const aliasName = state.nameRegistry.registerPathName({
      path,
      name: resolvedName
    })

    state.aliasTargetByPath.set(path, aliasTargetName)
    return aliasName
  }

  const name = state.nameRegistry.registerPathName({
    path,
    name: resolvedName
  })

  registerStructureName({ schema, name, state })

  return name
}

function resolveScanName ({ schema, path, suggestedName, state }) {
  if (path === '#') {
    return state.rootName
  }

  if (schema?.$ref && isNestedPropertyPath(path)) {
    return null
  }

  if (suggestedName) {
    return normalizeTypeName(suggestedName)
  }

  if (isDefinitionPath(path)) {
    return schema.title
      ? normalizeTypeName(schema.title)
      : getFallbackNameFromPath({ path })
  }

  if (isItemPath(path) && schema.title) {
    return normalizeTypeName(schema.title)
  }

  return null
}

function getFallbackNameFromPath ({ path }) {
  return normalizeTypeName(path.split('/').at(-1) || 'Schema')
}

function getArrayItemSuggestedName ({ schema, path, parentName }) {
  const propertyName = getPropertyNameFromPath({ path })
  if (isInlineArrayItemSchema({ schema })) {
    return ''
  }

  if (propertyName) {
    return singularizeTypeName(propertyName)
  }

  if (schema?.title) {
    return normalizeTypeName(schema.title)
  }

  return joinTypeName({ prefix: singularizeTypeName(parentName), suffix: 'Item' })
}

function getCombinatorSuggestedName ({ memberSchema, parentName, kind, index }) {
  if (memberSchema?.$ref) {
    return getFallbackNameFromPath({ path: toRefPath(memberSchema.$ref) })
  }

  const discriminatorValue = getDiscriminatorConstValue({ schema: memberSchema })
  if (discriminatorValue) {
    return `${normalizeTypeName(discriminatorValue.toLowerCase())}${singularizeTypeName(parentName)}`
  }

  return joinTypeName({ prefix: parentName, suffix: `${kind}${index + 1}` })
}

function getPropertyNameFromPath ({ path }) {
  const match = path.match(/\/properties\/([^/]+)$/)
  if (!match) {
    return null
  }

  return match[1]
}

function getDiscriminatorConstValue ({ schema }) {
  for (const propertySchema of Object.values(schema?.properties || {})) {
    if (propertySchema?.const !== undefined && typeof propertySchema.const === 'string') {
      return propertySchema.const
    }
  }

  return null
}

function isNestedPropertyPath (path) {
  return /^#\/properties\/[^/]+\/properties\//.test(path) || /\/properties\/[^/]+\/properties\//.test(path)
}

function isInlineArrayItemSchema ({ schema }) {
  if (!schema || typeof schema !== 'object') {
    return true
  }

  if (schema.$ref) {
    return false
  }

  if (Array.isArray(schema.enum)) {
    return false
  }

  if (schema.const !== undefined) {
    return true
  }

  return ['string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)
}

function isSimpleArrayItemSchema ({ schema }) {
  if (!schema || typeof schema !== 'object') {
    return false
  }

  if (schema.const !== undefined || Array.isArray(schema.enum)) {
    return true
  }

  return ['string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)
}

function isUnionBranchPropertyPath (path) {
  return /\/(?:oneOf|anyOf)\/\d+\/properties\/[^/]+$/.test(path)
}

function isInlineFormattedScalarSchema ({ schema }) {
  if (!schema || typeof schema !== 'object') {
    return false
  }

  return schema.type === 'string' && (Boolean(schema.format) || Boolean(schema.pattern))
}

function isArraySchema ({ schema }) {
  return schema?.type === 'array' || Array.isArray(schema?.items)
}

function isDefinitionPath (path) {
  return /\/(definitions|\$defs)\/[^/]+$/.test(path)
}

function isItemPath (path) {
  return /\/items(\/\d+)?$/.test(path)
}

function isDirectPropertyPath (path) {
  return /^#(?:\/(?:definitions|\$defs)\/[^/]+)*\/properties\/[^/]+$/.test(path)
}

function isPropertyPath (path) {
  return /\/properties\/[^/]+$/.test(path)
}

function getReferenceBoundaryPath ({ path }) {
  const definitionMatch = path.match(/^#\/(definitions|\$defs)\/[^/]+/)
  if (definitionMatch) {
    return definitionMatch[0]
  }

  const branchMatch = path.match(/^#\/(?:oneOf|anyOf|allOf)\/\d+/)
  if (branchMatch) {
    return branchMatch[0]
  }

  const arrayItemMatch = path.match(/^#\/properties\/[^/]+\/items/)
  if (arrayItemMatch) {
    return arrayItemMatch[0]
  }

  const rootPropertyMatch = path.match(/^#\/properties\/[^/]+/)
  if (rootPropertyMatch) {
    return rootPropertyMatch[0]
  }

  return '#'
}

function isPathWithinBoundary ({ path, boundaryPath }) {
  return path === boundaryPath || path.startsWith(`${boundaryPath}/`)
}

function shouldExpandNestedReference ({ path, targetPath }) {
  return isPathWithinBoundary({
    path: targetPath,
    boundaryPath: getReferenceBoundaryPath({ path })
  })
}

function isSchemaObject (value) {
  return value !== null && typeof value === 'object'
}

function registerStructureName ({ schema, name, state }) {
  const reuseKey = getSchemaReuseKey({ schema })
  if (!reuseKey || state.nameRegistry.hasStructureName({ key: reuseKey })) {
    return
  }

  state.nameRegistry.setStructureName({ key: reuseKey, name })
}

function getSchemaReuseKey ({ schema }) {
  if (!isSchemaObject(schema) || schema.$ref) {
    return null
  }

  return JSON.stringify(simplifySchema({ schema }))
}

function simplifySchema ({ schema }) {
  if (!isSchemaObject(schema)) {
    return schema
  }

  const simplified = {}

  for (const key of ['title', 'description', 'type', 'format', 'pattern', 'minimum', 'const']) {
    if (schema[key] !== undefined) {
      simplified[key] = schema[key]
    }
  }

  if (Array.isArray(schema.enum)) {
    simplified.enum = [...schema.enum]
  }

  if (Array.isArray(schema.required)) {
    simplified.required = [...schema.required]
  }

  if (isSchemaObject(schema.properties)) {
    simplified.properties = Object.keys(schema.properties).sort().reduce((acc, key) => {
      acc[key] = simplifySchema({ schema: schema.properties[key] })
      return acc
    }, {})
  }

  if (schema.items) {
    simplified.items = Array.isArray(schema.items)
      ? schema.items.map(item => simplifySchema({ schema: item }))
      : simplifySchema({ schema: schema.items })
  }

  if (isSchemaObject(schema.additionalProperties)) {
    simplified.additionalProperties = simplifySchema({ schema: schema.additionalProperties })
  } else if (schema.additionalProperties !== undefined) {
    simplified.additionalProperties = schema.additionalProperties
  }

  if (isSchemaObject(schema.patternProperties)) {
    simplified.patternProperties = Object.keys(schema.patternProperties).sort().reduce((acc, key) => {
      acc[key] = simplifySchema({ schema: schema.patternProperties[key] })
      return acc
    }, {})
  }

  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) {
      simplified[key] = schema[key].map(member => simplifySchema({ schema: member }))
    }
  }

  return simplified
}
