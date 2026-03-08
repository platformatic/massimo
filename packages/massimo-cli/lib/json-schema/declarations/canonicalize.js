import { normalizeTypeName } from '../core/naming.js'
import { getScannedSchemaAtPath } from '../core/scanner.js'
import {
  buildCollapsedChildName,
  compareCanonicalPaths,
  getCollapsedOwnerPrefix,
  getDeclarationOwnerScopePath,
  getDeclarationSchemaReuseKey,
  getNestedArrayItemName,
  getObjectUnionInfo,
  getPreferredPathName,
  getUnionLocalPrefix,
  isNamedArrayPath,
  isNamedScalarArraySchema,
  isReusableScalarSchema,
  isTopLevelArrayItemPath,
  isValueBranchScalarPath,
  resolveDeclarationSchema,
  shouldCollapseDirectContainerChildren,
  shouldUseRootUnionPropertyName,
  singularizeName
} from './helpers.js'

export function canonicalizeDeclarationState ({ state }) {
  const nameOverrides = buildDeclarationNameOverrides({ state })
  const stateWithOverrides = {
    ...state,
    nameOverrides
  }

  enforceStableArrayItemNames({ state: stateWithOverrides, nameOverrides })
  enforceStableNameConflicts({ state: stateWithOverrides, nameOverrides })

  return {
    ...state,
    nameOverrides,
    structuralAliasTargets: buildStructuralAliasTargets({
      state: {
        ...state,
        nameOverrides
      }
    })
  }
}

function buildDeclarationNameOverrides ({ state }) {
  const overrides = new Map()
  const paths = [...state.nameRegistry.getPathEntries().keys()].sort((left, right) => left.length - right.length)

  for (const path of paths) {
    const schema = getScannedSchemaAtPath({ path, state })

    if (isNamedArrayPath({ path, state, schema })) {
      const itemPath = `${path}/items`
      applySubtreeNameOverride({
        rootPath: itemPath,
        nextRootName: singularizeName({ name: getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } }) }),
        overrides,
        state
      })
    }

    const unionInfo = getObjectUnionInfo({ path, schema, state: { ...state, nameOverrides: overrides } })
    if (!unionInfo) {
      continue
    }

    applyRootUnionBranchPropertyOverrides({ path, unionInfo, overrides, state })
    applyRootUnionBranchChildOverrides({ path, unionInfo, overrides, state })
    applySharedUnionBranchPropertyOverrides({ path, unionInfo, overrides, state })
    applyPropertyUnionBranchOverrides({ path, unionInfo, overrides, state })
    applyNestedUnionBranchOverrides({ path, unionInfo, overrides, state })
    applyBranchLeafOverrides({ path, unionInfo, overrides, state })
  }

  return overrides
}

function enforceStableArrayItemNames ({ state, nameOverrides }) {
  const paths = [...state.nameRegistry.getPathEntries().keys()].sort(compareCanonicalPaths)

  for (const path of paths) {
    const schema = getScannedSchemaAtPath({ path, state })
    if (!isNamedArrayPath({ path, state: { ...state, nameOverrides }, schema })) {
      continue
    }

    const itemPath = `${path}/items`
    const arrayName = getPreferredPathName({ path, state: { ...state, nameOverrides } })
    const itemName = getPreferredPathName({ path: itemPath, state: { ...state, nameOverrides } })
    if (!arrayName || !itemName || arrayName !== itemName) {
      continue
    }

    const singularName = singularizeName({ name: arrayName })
    applySubtreeNameOverride({
      rootPath: itemPath,
      nextRootName: singularName === arrayName ? `${arrayName}Item` : singularName,
      overrides: nameOverrides,
      state
    })
  }
}

function enforceStableNameConflicts ({ state, nameOverrides }) {
  const countsByName = new Map()
  const paths = [...state.nameRegistry.getPathEntries().keys()].sort(compareCanonicalPaths)

  for (const path of paths) {
    const name = getPreferredPathName({ path, state: { ...state, nameOverrides } })
    if (!name) {
      continue
    }

    const count = countsByName.get(name) || 0
    countsByName.set(name, count + 1)

    if (count === 0) {
      continue
    }

    applySubtreeNameOverride({
      rootPath: path,
      nextRootName: `${name}_${count}`,
      overrides: nameOverrides,
      state
    })
  }
}

function buildStructuralAliasTargets ({ state }) {
  const targets = new Map()
  const candidatePaths = [...state.nameRegistry.getPathEntries().keys()].sort(compareCanonicalPaths)

  for (const path of candidatePaths) {
    const schema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path, state }),
      state
    })
    if (!isReusableScalarSchema({ schema }) || !isValueBranchScalarPath({ path })) {
      continue
    }

    const reuseKey = getDeclarationSchemaReuseKey({ schema })
    if (!reuseKey) {
      continue
    }

    const sameScopePath = candidatePaths.find(candidatePath => {
      if (candidatePath === path) {
        return false
      }

      if (getDeclarationOwnerScopePath({ path: candidatePath }) !== getDeclarationOwnerScopePath({ path })) {
        return false
      }

      const candidateSchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: candidatePath, state }),
        state
      })
      return getDeclarationSchemaReuseKey({ schema: candidateSchema }) === reuseKey
    })

    if (sameScopePath) {
      targets.set(path, getPreferredPathName({ path: sameScopePath, state }))
      continue
    }

    const globalPath = candidatePaths.find(candidatePath => {
      if (candidatePath === path) {
        return false
      }

      const candidateSchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: candidatePath, state }),
        state
      })
      return getDeclarationSchemaReuseKey({ schema: candidateSchema }) === reuseKey
    })

    if (globalPath) {
      targets.set(path, getPreferredPathName({ path: globalPath, state }))
    }
  }

  return targets
}

function applyRootUnionBranchPropertyOverrides ({ path, unionInfo, overrides, state }) {
  if (path !== '#') {
    return
  }

  const ownerName = getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } })
  if (!ownerName) {
    return
  }

  const propertyEntriesByName = new Map()
  for (const branchPath of unionInfo.branchPaths) {
    const branchSchema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path: branchPath, state }),
      state
    })

    for (const [propertyName, propertySchema] of Object.entries(branchSchema?.properties || {})) {
      if (propertySchema?.const !== undefined) {
        continue
      }

      const propertyPath = `${branchPath}/properties/${propertyName}`
      const resolvedPropertySchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: propertyPath, state }) || propertySchema,
        state
      })

      const entries = propertyEntriesByName.get(propertyName) || []
      entries.push({
        path: propertyPath,
        key: getDeclarationSchemaReuseKey({ schema: resolvedPropertySchema }),
        schema: resolvedPropertySchema
      })
      propertyEntriesByName.set(propertyName, entries)
    }
  }

  for (const [propertyName, entries] of propertyEntriesByName.entries()) {
    if (!shouldUseRootUnionPropertyName({ entries })) {
      continue
    }

    for (const entry of entries) {
      applySubtreeNameOverride({
        rootPath: entry.path,
        nextRootName: `${ownerName}${normalizeTypeName(propertyName)}`,
        overrides,
        state
      })
    }
  }
}

function applyRootUnionBranchChildOverrides ({ path, unionInfo, overrides, state }) {
  if (path !== '#') {
    return
  }

  const ownerName = getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } })
  if (!ownerName) {
    return
  }

  for (const branchPath of unionInfo.branchPaths) {
    const branchName = getPreferredPathName({ path: branchPath, state: { ...state, nameOverrides: overrides } })
    const branchSchema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path: branchPath, state }),
      state
    })

    if (!branchName || !branchSchema?.properties) {
      continue
    }

    for (const propertyName of Object.keys(branchSchema.properties)) {
      const propertyPath = `${branchPath}/properties/${propertyName}`
      const propertyTypeName = getPreferredPathName({ path: propertyPath, state: { ...state, nameOverrides: overrides } })
      const rootScopedName = `${ownerName}${normalizeTypeName(propertyName)}`
      if (!propertyTypeName) {
        continue
      }

      const propertySchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: propertyPath, state }),
        state
      })

      if (propertyTypeName !== rootScopedName && propertyTypeName.startsWith(branchName)) {
        for (const childName of Object.keys(propertySchema?.properties || {})) {
          applySubtreeNameOverride({
            rootPath: `${propertyPath}/properties/${childName}`,
            nextRootName: `${branchName}${normalizeTypeName(childName)}`,
            overrides,
            state
          })
        }
      }

      const ownerPrefix = getCollapsedOwnerPrefix({ typeName: propertyTypeName, propertyName })
      if (!ownerPrefix || !shouldCollapseDirectContainerChildren({ propertyName, schema: propertySchema })) {
        continue
      }

      applyCollapsedContainerChildOverrides({
        containerPath: propertyPath,
        containerSchema: propertySchema,
        ownerPrefix,
        overrides,
        state
      })

      for (const childName of Object.keys(propertySchema?.properties || {})) {
        const childPath = `${propertyPath}/properties/${childName}`
        const childSchema = resolveDeclarationSchema({
          schema: getScannedSchemaAtPath({ path: childPath, state }),
          state
        })
        const childTypeName = getPreferredPathName({ path: childPath, state: { ...state, nameOverrides: overrides } })
        const childOwnerPrefix = getCollapsedOwnerPrefix({ typeName: childTypeName, propertyName: childName })
        if (!childOwnerPrefix || !shouldCollapseDirectContainerChildren({ propertyName: childName, schema: childSchema })) {
          continue
        }

        applyCollapsedContainerChildOverrides({
          containerPath: childPath,
          containerSchema: childSchema,
          ownerPrefix: childOwnerPrefix,
          overrides,
          state
        })
      }
    }
  }
}

function applyCollapsedContainerChildOverrides ({ containerPath, containerSchema, ownerPrefix, overrides, state }) {
  if (!containerSchema?.properties) {
    return
  }

  for (const childName of Object.keys(containerSchema.properties)) {
    const childPath = `${containerPath}/properties/${childName}`
    const childSchema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path: childPath, state }) || containerSchema.properties[childName],
      state
    })
    const currentChildName = getPreferredPathName({ path: childPath, state: { ...state, nameOverrides: overrides } })
    const nextChildName = buildCollapsedChildName({
      ownerPrefix,
      propertyName: childName,
      schema: childSchema,
      fallbackName: currentChildName
    })

    if (!nextChildName) {
      continue
    }

    applySubtreeNameOverride({
      rootPath: childPath,
      nextRootName: nextChildName,
      overrides,
      state
    })

    if (childSchema?.type === 'array' && !Array.isArray(childSchema.items)) {
      const itemPath = `${childPath}/items`
      const currentItemName = getPreferredPathName({ path: itemPath, state: { ...state, nameOverrides: overrides } })
      const nextItemName = buildCollapsedChildName({
        ownerPrefix,
        propertyName: childName,
        schema: childSchema.items,
        fallbackName: currentItemName ? singularizeName({ name: currentItemName }) : singularizeName({ name: nextChildName }),
        singular: true
      })

      applySubtreeNameOverride({
        rootPath: itemPath,
        nextRootName: nextItemName,
        overrides,
        state
      })
    }
  }
}

function applySharedUnionBranchPropertyOverrides ({ path, unionInfo, overrides, state }) {
  const ownerName = getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } })
  if (!ownerName) {
    return
  }

  const propertyEntriesByName = new Map()
  for (const branchPath of unionInfo.branchPaths) {
    const branchSchema = getScannedSchemaAtPath({ path: branchPath, state })
    for (const propertyName of Object.keys(branchSchema?.properties || {})) {
      const propertySchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: `${branchPath}/properties/${propertyName}`, state }),
        state
      })

      if (!propertySchema || propertySchema.const !== undefined) {
        continue
      }

      const entries = propertyEntriesByName.get(propertyName) || []
      entries.push({
        path: `${branchPath}/properties/${propertyName}`,
        key: getDeclarationSchemaReuseKey({ schema: propertySchema })
      })
      propertyEntriesByName.set(propertyName, entries)
    }
  }

  for (const [propertyName, entries] of propertyEntriesByName.entries()) {
    if (entries.length < 2) {
      continue
    }

    const uniqueKeys = [...new Set(entries.map(entry => entry.key))]
    if (uniqueKeys.length !== 1 || !uniqueKeys[0]) {
      continue
    }

    for (const entry of entries) {
      applySubtreeNameOverride({
        rootPath: entry.path,
        nextRootName: `${ownerName}${normalizeTypeName(propertyName)}`,
        overrides,
        state
      })
    }
  }
}

function applyPropertyUnionBranchOverrides ({ path, unionInfo, overrides, state }) {
  const ownerName = getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } })
  if (!ownerName) {
    return
  }

  for (const propertyName of Object.keys(resolveDeclarationSchema({
    schema: getScannedSchemaAtPath({ path, state }),
    state
  }).properties || {})) {
    const propertyInfo = getObjectUnionPropertyInfo({ path: `${path}/properties/${propertyName}`, state: { ...state, nameOverrides: overrides } })
    if (!propertyInfo) {
      continue
    }

    const propertyTypeName = getPreferredPathName({
      path: `${path}/properties/${propertyName}`,
      state: { ...state, nameOverrides: overrides }
    })
    const propertySuffix = propertyTypeName?.startsWith(ownerName)
      ? propertyTypeName.slice(ownerName.length)
      : normalizeTypeName(propertyName)

    for (const branchPath of unionInfo.branchPaths) {
      const branchName = getPreferredPathName({ path: branchPath, state: { ...state, nameOverrides: overrides } })
      if (!branchName || !branchName.endsWith(ownerName)) {
        continue
      }

      const branchStem = branchName.slice(0, -ownerName.length)
      applySubtreeNameOverride({
        rootPath: `${branchPath}/properties/${propertyName}`,
        nextRootName: `${ownerName}${branchStem}${propertySuffix}`,
        overrides,
        state
      })
    }
  }
}

function applyNestedUnionBranchOverrides ({ path, unionInfo, overrides, state }) {
  if (path === '#' || isTopLevelArrayItemPath({ path })) {
    return
  }

  const ownerName = getPreferredPathName({ path, state: { ...state, nameOverrides: overrides } })
  const localRootName = state.nameRegistry.getPathName({ path })
  const stripPrefix = getUnionLocalPrefix({ path, localRootName, state })
  if (!ownerName || !stripPrefix) {
    return
  }

  for (const branchPath of unionInfo.branchPaths) {
    const branchName = state.nameRegistry.getPathName({ path: branchPath })
    if (!branchName) {
      continue
    }

    const suffix = branchName.startsWith(stripPrefix)
      ? branchName.slice(stripPrefix.length)
      : branchName

    applySubtreeNameOverride({
      rootPath: branchPath,
      nextRootName: `${ownerName}${suffix}`,
      overrides,
      state
    })
  }
}

function applyBranchLeafOverrides ({ path, unionInfo, overrides, state }) {
  if (path === '#' || isTopLevelArrayItemPath({ path })) {
    return
  }

  for (const branchPath of unionInfo.branchPaths) {
    const branchName = getPreferredPathName({ path: branchPath, state: { ...state, nameOverrides: overrides } })
    const branchSchema = resolveDeclarationSchema({
      schema: getScannedSchemaAtPath({ path: branchPath, state }),
      state
    })

    if (!branchName || !branchSchema?.properties) {
      continue
    }

    for (const [propertyName, propertySchema] of Object.entries(branchSchema.properties)) {
      const propertyPath = `${branchPath}/properties/${propertyName}`
      const resolvedPropertySchema = resolveDeclarationSchema({
        schema: getScannedSchemaAtPath({ path: propertyPath, state }) || propertySchema,
        state
      })

      if (isNamedScalarArraySchema({ schema: resolvedPropertySchema })) {
        const normalizedPropertyName = normalizeTypeName(propertyName)
        const normalizedArrayName = branchName.endsWith(normalizedPropertyName)
          ? branchName
          : null

        if (normalizedArrayName) {
          applySubtreeNameOverride({
            rootPath: propertyPath,
            nextRootName: normalizedArrayName,
            overrides,
            state
          })
        }

        applySubtreeNameOverride({
          rootPath: `${propertyPath}/items`,
          nextRootName: getNestedArrayItemName({
            branchName: normalizedArrayName || branchName,
            propertyName
          }),
          overrides,
          state
        })
      }
    }
  }
}

function applySubtreeNameOverride ({ rootPath, nextRootName, overrides, state }) {
  const currentRootName = overrides.get(rootPath) || state.nameRegistry.getPathName({ path: rootPath })
  if (!currentRootName || !nextRootName || currentRootName === nextRootName) {
    return
  }

  overrides.set(rootPath, nextRootName)

  for (const [path, currentName] of state.nameRegistry.getPathEntries().entries()) {
    if (!path.startsWith(`${rootPath}/`)) {
      continue
    }

    const existingName = overrides.get(path) || currentName
    if (existingName.startsWith(currentRootName)) {
      overrides.set(path, `${nextRootName}${existingName.slice(currentRootName.length)}`)
    }
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
