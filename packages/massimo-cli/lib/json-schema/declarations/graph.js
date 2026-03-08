import { getCommentLines } from '../comments.js'
import { createRenderContext, buildObjectTypeLines, renderType } from '../render/index.js'
import {
  getAliasSourceSchema,
  getAliasTargetName,
  getScannedSchemaAtPath,
  shouldInlineArrayPropertyType,
  shouldInlineNamedScalarPropertyType
} from '../core/scanner.js'
import {
  getObjectUnionInfo,
  getPreferredPathName,
  hasObjectMembers,
  isReusableScalarSchema,
  isUnionBranchPropertyPath,
  isValueBranchScalarPath,
  omitProperties,
  resolveDeclarationSchema,
  shouldEmitOmittedUnionPropertyDeclaration,
  shouldUseInterface
} from './helpers.js'

export function buildDeclarationGraph ({ state }) {
  const nodes = new Map()
  const entryIds = collectDeclarationGraphForPath({
    path: '#',
    state,
    nodes,
    visitedPaths: new Set()
  })

  return {
    nodes,
    entryIds
  }
}

export function renderDeclarationGraph ({ graph }) {
  const declarations = []
  const emittedIds = new Set()

  for (const entryId of graph.entryIds) {
    emitDeclarationNode({
      id: entryId,
      graph,
      declarations,
      emittedIds
    })
  }

  return declarations
}

function buildDeclaration ({ path, name, schema, state, inlineConstPathNames = false }) {
  const unionPropertyDeclaration = buildObjectUnionPropertyDeclaration({ path, name, schema, state })
  if (unionPropertyDeclaration) {
    return unionPropertyDeclaration
  }

  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  const aliasTargetName = getAliasTargetName({ path, state })
  const structuralAliasTargetName = !aliasTargetName
    ? getStructuralAliasTargetName({ path, schema: resolvedSchema, state })
    : null

  if (aliasTargetName || structuralAliasTargetName) {
    const aliasSourceSchema = getAliasSourceSchema({ path, state })
    const commentSchema = getCommentLines({ schema: aliasSourceSchema, name })
      ? aliasSourceSchema
      : getCommentLines({ schema, name })
        ? schema
        : resolvedSchema
    return {
      kind: 'type',
      name,
      comment: getCommentLines({ schema: commentSchema, name }),
      value: aliasTargetName || structuralAliasTargetName,
      skipDependencies: true
    }
  }

  const context = createRenderContext({
    schema: resolvedSchema,
    state,
    path,
    lookupPathName: false,
    lookupChildPathNames: true,
    inlineConstPathNames
  })

  if (shouldUseInterface({ schema: resolvedSchema })) {
    return {
      kind: 'interface',
      name,
      extends: [],
      comment: getCommentLines({ schema: resolvedSchema, name }),
      bodyLines: buildObjectTypeLines({ context, renderType })
    }
  }

  return {
    kind: 'type',
    name,
    comment: getCommentLines({ schema: resolvedSchema, name }),
    value: renderType({ context })
  }
}

function collectDeclarationGraphForPath ({ path, state, nodes, visitedPaths }) {
  if (visitedPaths.has(path) || !state.nameRegistry.hasPathName({ path })) {
    return []
  }

  visitedPaths.add(path)

  const schema = getScannedSchemaAtPath({ path, state })
  if (!schema) {
    return []
  }

  const unionInfo = getObjectUnionInfo({ path, schema, state })
  if (unionInfo) {
    return collectObjectUnionGraphNodes({
      path,
      schema,
      state,
      nodes,
      visitedPaths,
      unionInfo
    })
  }

  const declaration = buildDeclaration({
    path,
    name: getPreferredPathName({ path, state }),
    schema,
    state
  })
  const dependencyPaths = declaration.skipDependencies
    ? []
    : (declaration.dependencyPaths || collectDependencyPaths({ schema, path, state }))

  for (const dependencyPath of dependencyPaths) {
    collectDeclarationGraphForPath({
      path: dependencyPath,
      state,
      nodes,
      visitedPaths
    })
  }

  nodes.set(path, createDeclarationNode({
    id: path,
    path,
    declaration,
    dependencyIds: dependencyPaths
      .map(dependencyPath => getDeclarationNodeIdForPath({ path: dependencyPath, state }))
      .filter(Boolean)
  }))

  return [path]
}

function collectObjectUnionGraphNodes ({ path, schema, state, nodes, visitedPaths, unionInfo }) {
  const unionName = getPreferredPathName({ path, state }) || unionInfo.name
  const omittedPropertyNames = getOmittedBasePropertyNames({ path, schema, state, unionInfo })
  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  const baseSchema = {
    ...resolvedSchema,
    properties: omitProperties({
      properties: resolvedSchema.properties,
      omittedPropertyNames
    }),
    required: (resolvedSchema.required || [])
      .filter(propertyName => !omittedPropertyNames.has(propertyName)),
    oneOf: undefined,
    anyOf: undefined,
    allOf: undefined
  }

  if (unionInfo.branchPaths.length === 1) {
    const branchPath = unionInfo.branchPaths[0]
    const branchSchema = getScannedSchemaAtPath({ path: branchPath, state })
    if (branchSchema) {
      const mergedSchema = mergeObjectUnionSchemas({
        baseSchema,
        branchSchema: mergeUnionBranchSchema({
          path,
          branchPath,
          branchSchema,
          state
        })
      })

      const dependencyPaths = collectDependencyPaths({ schema: mergedSchema, path, state })
      for (const dependencyPath of dependencyPaths) {
        collectDeclarationGraphForPath({
          path: dependencyPath,
          state,
          nodes,
          visitedPaths
        })
      }

      nodes.set(path, createDeclarationNode({
        id: path,
        path,
        declaration: buildDeclaration({
          path,
          name: unionName,
          schema: mergedSchema,
          state
        }),
        dependencyIds: dependencyPaths
          .map(dependencyPath => getDeclarationNodeIdForPath({ path: dependencyPath, state }))
          .filter(Boolean)
      }))

      return [path]
    }
  }

  const hasBaseProperties = Object.keys(baseSchema.properties || {}).length > 0
  const entryIds = []
  const baseId = `${path}::base`
  const baseDeclaration = hasBaseProperties
    ? {
        kind: 'interface',
        name: unionInfo.baseName,
        extends: [],
        comment: null,
        bodyLines: buildObjectTypeLines({
          context: createRenderContext({
            schema: baseSchema,
            state,
            path,
            lookupPathName: false,
            lookupChildPathNames: true
          }),
          renderType
        })
      }
    : null

  if (baseDeclaration && path === '#') {
    nodes.set(baseId, createDeclarationNode({
      id: baseId,
      path,
      declaration: baseDeclaration,
      dependencyIds: collectDependencyPaths({ schema: baseSchema, path, state })
        .map(dependencyPath => getDeclarationNodeIdForPath({ path: dependencyPath, state }))
        .filter(Boolean)
    }))
    entryIds.push(baseId)
  }

  const omittedEntryIds = collectObjectUnionBaseEntryIds({
    path,
    schema: resolvedSchema,
    omittedPropertyNames,
    state,
    nodes,
    visitedPaths
  })
  entryIds.push(...omittedEntryIds)

  if (baseDeclaration && path !== '#') {
    nodes.set(baseId, createDeclarationNode({
      id: baseId,
      path,
      declaration: baseDeclaration,
      dependencyIds: collectDependencyPaths({ schema: baseSchema, path, state })
        .map(dependencyPath => getDeclarationNodeIdForPath({ path: dependencyPath, state }))
        .filter(Boolean)
    }))
    entryIds.push(baseId)
  }

  const branchNames = []
  const branchIds = []
  for (const branchPath of unionInfo.branchPaths) {
    const branchName = getPreferredPathName({ path: branchPath, state })
    const branchSchema = getScannedSchemaAtPath({ path: branchPath, state })
    if (!branchName || !branchSchema) {
      continue
    }

    branchNames.push(branchName)
    const mergedBranchSchema = mergeUnionBranchSchema({
      path,
      branchPath,
      branchSchema,
      state
    })

    const branchDependencyPaths = collectDependencyPaths({ schema: branchSchema, path: branchPath, state })
    for (const dependencyPath of branchDependencyPaths) {
      collectDeclarationGraphForPath({
        path: dependencyPath,
        state,
        nodes,
        visitedPaths
      })
    }

    nodes.set(branchPath, createDeclarationNode({
      id: branchPath,
      path: branchPath,
      declaration: {
        kind: 'interface',
        name: branchName,
        extends: hasBaseProperties ? [unionInfo.baseName] : [],
        comment: null,
        bodyLines: buildObjectTypeLines({
          context: createRenderContext({
            schema: mergedBranchSchema,
            state,
            path: branchPath,
            lookupPathName: false,
            lookupChildPathNames: true,
            inlineConstPathNames: true
          }),
          renderType
        })
      },
      dependencyIds: [
        ...(hasBaseProperties ? [baseId] : []),
        ...branchDependencyPaths
          .map(dependencyPath => getDeclarationNodeIdForPath({ path: dependencyPath, state }))
          .filter(Boolean)
      ]
    }))
    branchIds.push(branchPath)
    entryIds.push(branchPath)
  }

  nodes.set(path, createDeclarationNode({
    id: path,
    path,
    declaration: {
      kind: 'type',
      name: unionName,
      comment: getCommentLines({ schema: resolvedSchema, name: unionName }),
      value: branchNames.join(' | ')
    },
    dependencyIds: [...omittedEntryIds, ...branchIds]
  }))
  entryIds.push(path)

  return entryIds
}

function collectObjectUnionBaseEntryIds ({
  path,
  schema,
  omittedPropertyNames,
  state,
  nodes,
  visitedPaths
}) {
  const entryIds = []
  const hasBaseProperties = Object.keys(
    omitProperties({
      properties: schema.properties,
      omittedPropertyNames
    }) || {}
  ).length > 0

  for (const propertyName of Object.keys(schema.properties || {})) {
    const propertyPath = `${path}/properties/${propertyName}`
    const propertySchema = schema.properties[propertyName]

    if (omittedPropertyNames.has(propertyName)) {
      if (!shouldEmitOmittedUnionPropertyDeclaration({ path, propertyName, hasBaseProperties })) {
        continue
      }

      entryIds.push(...collectDeclarationGraphForPath({
        path: propertyPath,
        state,
        nodes,
        visitedPaths
      }))
      continue
    }

    if (shouldInlineArrayPropertyType({ path: propertyPath, schema: propertySchema, state })) {
      const itemPath = `${propertyPath}/items`
      if (state.nameRegistry.hasPathName({ path: itemPath })) {
        entryIds.push(...collectDeclarationGraphForPath({
          path: itemPath,
          state,
          nodes,
          visitedPaths
        }))
      }
      continue
    }

    if (shouldInlineNamedScalarPropertyType({ path: propertyPath, schema: propertySchema, state })) {
      continue
    }

    if (propertySchema?.const !== undefined && isUnionBranchPropertyPath({ path: propertyPath })) {
      continue
    }

    if (!state.nameRegistry.hasPathName({ path: propertyPath })) {
      continue
    }

    entryIds.push(...collectDeclarationGraphForPath({
      path: propertyPath,
      state,
      nodes,
      visitedPaths
    }))
  }

  return entryIds
}

function createDeclarationNode ({ id, path, declaration, dependencyIds }) {
  return {
    id,
    path,
    declaration,
    dependencyIds: [...new Set(dependencyIds)].filter(dependencyId => dependencyId !== id)
  }
}

function emitDeclarationNode ({ id, graph, declarations, emittedIds }) {
  if (emittedIds.has(id)) {
    return
  }

  const node = graph.nodes.get(id)
  if (!node) {
    return
  }

  emittedIds.add(id)
  declarations.push(node.declaration)

  for (const dependencyId of node.dependencyIds) {
    emitDeclarationNode({
      id: dependencyId,
      graph,
      declarations,
      emittedIds
    })
  }
}

function getDeclarationNodeIdForPath ({ path, state }) {
  const schema = getScannedSchemaAtPath({ path, state })
  if (!schema) {
    return null
  }

  const unionInfo = getObjectUnionInfo({ path, schema, state })
  if (!unionInfo) {
    return path
  }

  return path
}

function getStructuralAliasTargetName ({ path, schema, state }) {
  if (!isReusableScalarSchema({ schema }) || !isValueBranchScalarPath({ path })) {
    return null
  }

  return state.structuralAliasTargets?.get(path) || null
}

function collectDependencyPaths ({ schema, path, state }) {
  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  const dependencyPaths = []

  collectObjectDependencyPaths({ schema: resolvedSchema, path, state, dependencyPaths })
  collectArrayDependencyPaths({ schema: resolvedSchema, path, state, dependencyPaths })
  collectCombinatorDependencyPaths({ schema: resolvedSchema, path, state, dependencyPaths })

  return [...new Set(dependencyPaths)].filter(dependencyPath => dependencyPath !== path)
}

function collectObjectDependencyPaths ({ schema, path, state, dependencyPaths }) {
  if (!hasObjectMembers({ schema })) {
    return
  }

  for (const propertyName of Object.keys(schema.properties || {})) {
    const propertyPath = `${path}/properties/${propertyName}`
    const propertySchema = schema.properties[propertyName]
    if (shouldInlineArrayPropertyType({ path: propertyPath, schema: propertySchema, state })) {
      const itemPath = `${propertyPath}/items`
      if (state.nameRegistry.hasPathName({ path: itemPath })) {
        dependencyPaths.push(itemPath)
      }
      continue
    }

    if (shouldInlineNamedScalarPropertyType({ path: propertyPath, schema: propertySchema, state })) {
      continue
    }

    if (propertySchema?.const !== undefined && isUnionBranchPropertyPath({ path: propertyPath })) {
      continue
    }

    if (state.nameRegistry.hasPathName({ path: propertyPath })) {
      dependencyPaths.push(propertyPath)
    }
  }
}

function collectArrayDependencyPaths ({ schema, path, state, dependencyPaths }) {
  if (!schema.items) {
    return
  }

  if (Array.isArray(schema.items)) {
    for (const index of schema.items.keys()) {
      const itemPath = `${path}/items/${index}`
      if (state.nameRegistry.hasPathName({ path: itemPath })) {
        dependencyPaths.push(itemPath)
      }
    }

    return
  }

  const itemPath = `${path}/items`
  if (state.nameRegistry.hasPathName({ path: itemPath })) {
    dependencyPaths.push(itemPath)
  }
}

function collectCombinatorDependencyPaths ({ schema, path, state, dependencyPaths }) {
  for (const keyword of ['oneOf', 'anyOf', 'allOf']) {
    if (!Array.isArray(schema[keyword])) {
      continue
    }

    for (const [index] of schema[keyword].entries()) {
      const memberPath = `${path}/${keyword}/${index}`
      const memberSchema = getScannedSchemaAtPath({ path: memberPath, state })
      if (memberSchema && renderDeclarationValue({ path: memberPath, schema: memberSchema, state }) === 'unknown') {
        continue
      }

      if (state.nameRegistry.hasPathName({ path: memberPath })) {
        dependencyPaths.push(memberPath)
      }
    }
  }
}

function buildObjectUnionPropertyDeclaration ({ path, name, schema, state }) {
  const propertyInfo = getObjectUnionPropertyInfo({ path, state })
  if (!propertyInfo) {
    return null
  }

  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  if (renderDeclarationValue({ path, schema: resolvedSchema, state }) !== 'unknown') {
    return null
  }

  return {
    kind: 'type',
    name,
    comment: getCommentLines({ schema: resolvedSchema, name }),
    value: propertyInfo.branchTypeNames.join(' | '),
    dependencyPaths: propertyInfo.branchPaths
  }
}

function getObjectUnionPropertyInfo ({ path, state }) {
  const match = path.match(/^(.*)\/properties\/([^/]+)$/)
  if (!match) {
    return null
  }

  const [, parentPath, propertyName] = match
  const parentSchema = getScannedSchemaAtPath({ path: parentPath, state })
  const unionInfo = getObjectUnionInfo({ path: parentPath, schema: parentSchema, state })
  if (!unionInfo) {
    return null
  }

  const branchTypeNames = unionInfo.branchPaths
    .map(branchPath => getPreferredPathName({ path: `${branchPath}/properties/${propertyName}`, state }))
    .filter(Boolean)

  if (branchTypeNames.length !== unionInfo.branchPaths.length) {
    return null
  }

  return {
    propertyName,
    branchTypeNames,
    branchPaths: unionInfo.branchPaths.map(branchPath => `${branchPath}/properties/${propertyName}`)
  }
}

function getOmittedBasePropertyNames ({ path, schema, state, unionInfo }) {
  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  const propertyNames = Object.keys(resolvedSchema.properties || {})
  const omitted = new Set()

  for (const propertyName of propertyNames) {
    const propertyPath = `${path}/properties/${propertyName}`
    const propertyInfo = getObjectUnionPropertyInfo({ path: propertyPath, state })
    if (!propertyInfo) {
      continue
    }

    const propertySchema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path: propertyPath, state }),
      state
    })

    if (shouldOmitObjectUnionBaseProperty({
      path,
      propertyName,
      propertySchema,
      state,
      unionInfo
    }) || renderDeclarationValue({
      path: propertyPath,
      schema: propertySchema,
      state
    }) === 'unknown') {
      omitted.add(propertyName)
    }
  }

  return omitted
}

function mergeUnionBranchSchema ({ path, branchPath, branchSchema, state }) {
  const parentSchema = getScannedSchemaAtPath({ path, state })
  const parentRequired = new Set(parentSchema?.required || [])
  const branchRequired = new Set(branchSchema.required || [])

  for (const propertyName of Object.keys(branchSchema.properties || {})) {
    if (parentRequired.has(propertyName)) {
      branchRequired.add(propertyName)
    }
  }

  return {
    ...branchSchema,
    required: [...branchRequired]
  }
}

function mergeObjectUnionSchemas ({ baseSchema, branchSchema }) {
  return {
    ...baseSchema,
    ...branchSchema,
    properties: {
      ...(baseSchema.properties || {}),
      ...(branchSchema.properties || {})
    },
    required: [...new Set([...(baseSchema.required || []), ...(branchSchema.required || [])])],
    oneOf: undefined,
    anyOf: undefined,
    allOf: undefined
  }
}

function shouldOmitObjectUnionBaseProperty ({ path, propertyName, propertySchema, state, unionInfo }) {
  if (path === '#' || propertySchema?.const !== undefined) {
    return false
  }

  return unionInfo.branchPaths.every(branchPath => {
    const branchPropertySchema = getScannedSchemaAtPath({
      path: `${branchPath}/properties/${propertyName}`,
      state
    })

    return branchPropertySchema?.const !== undefined
  })
}

function renderDeclarationValue ({ path, schema, state }) {
  return renderType({
    context: createRenderContext({
      schema,
      state,
      path,
      lookupPathName: false,
      lookupChildPathNames: true
    })
  })
}
