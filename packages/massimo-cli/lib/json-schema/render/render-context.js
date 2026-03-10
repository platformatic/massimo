/**
 * Create the rendering context object shared by all nested render helpers.
 */
export function createRenderContext ({
  schema,
  state,
  path = '#',
  lookupPathName = true,
  lookupChildPathNames = lookupPathName,
  inlineConstPathNames = false
}) {
  return {
    schema,
    rootSchema: state.rootSchema,
    nameRegistry: state.nameRegistry,
    aliasTargetByPath: state.aliasTargetByPath,
    refByPath: state.refByPath,
    nameOverrides: state.nameOverrides,
    path,
    lookupPathName,
    lookupChildPathNames,
    inlineConstPathNames
  }
}

/**
 * Create a child rendering context for a nested schema path.
 */
export function createChildRenderContext ({ context, schema, pathSuffix, lookupPathName = context.lookupChildPathNames }) {
  return {
    schema,
    rootSchema: context.rootSchema,
    nameRegistry: context.nameRegistry,
    aliasTargetByPath: context.aliasTargetByPath,
    refByPath: context.refByPath,
    nameOverrides: context.nameOverrides,
    path: `${context.path}/${pathSuffix}`,
    lookupPathName,
    lookupChildPathNames: context.lookupChildPathNames,
    inlineConstPathNames: context.inlineConstPathNames
  }
}
