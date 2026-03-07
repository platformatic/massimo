import { createNameRegistry } from './name-registry.js'
import { getDefaultRootName, joinTypeName, normalizeTypeName } from './naming.js'
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

  return state
}

export function createScanState ({ schema, rootName = undefined }) {
  return {
    rootSchema: schema,
    rootName: getDefaultRootName({ schema, rootName }),
    nameRegistry: createNameRegistry(),
    references: new Set()
  }
}

function traverseSchema ({ schema, path, suggestedName, state }) {
  if (!isSchemaObject(schema)) {
    return
  }

  if (schema.$ref) {
    state.references.add(schema.$ref)
  }

  const name = getRegisteredName({ schema, path, suggestedName, state })

  traverseDefinitions({ schema, path, state })
  traverseProperties({ schema, path, parentName: name || suggestedName, state })
  traverseItems({ schema, path, parentName: name || suggestedName, state })
  traverseAdditionalProperties({ schema, path, parentName: name || suggestedName, state })
  traverseCombinators({ schema, path, parentName: name || suggestedName, state })
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
    traverseSchema({
      schema: propertySchema,
      path: `${path}/properties/${propertyName}`,
      suggestedName: joinTypeName({ prefix: parentName, suffix: propertyName }),
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

  traverseSchema({
    schema: schema.items,
    path: `${path}/items`,
    suggestedName: joinTypeName({ prefix: parentName, suffix: 'Item' }),
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
      suggestedName: memberSchema?.$ref
        ? ''
        : joinTypeName({ prefix: parentName, suffix: `${kind}${index + 1}` }),
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

function getRegisteredName ({ schema, path, suggestedName, state }) {
  if (state.nameRegistry.hasPathName({ path })) {
    return state.nameRegistry.getPathName({ path })
  }

  const resolvedName = resolveScanName({ schema, path, suggestedName, state })
  if (!resolvedName) {
    return null
  }

  return state.nameRegistry.registerPathName({
    path,
    name: resolvedName
  })
}

function resolveScanName ({ schema, path, suggestedName, state }) {
  if (path === '#') {
    return state.rootName
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

function isDefinitionPath (path) {
  return /\/(definitions|\$defs)\/[^/]+$/.test(path)
}

function isItemPath (path) {
  return /\/items(\/\d+)?$/.test(path)
}

function isSchemaObject (value) {
  return value !== null && typeof value === 'object'
}
