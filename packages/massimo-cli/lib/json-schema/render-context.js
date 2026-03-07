export function createRenderContext ({ schema, state, path = '#', lookupPathName = true, lookupChildPathNames = lookupPathName }) {
  return {
    schema,
    rootSchema: state.rootSchema,
    nameRegistry: state.nameRegistry,
    path,
    lookupPathName,
    lookupChildPathNames
  }
}

export function createChildRenderContext ({ context, schema, pathSuffix, lookupPathName = context.lookupChildPathNames }) {
  return {
    schema,
    rootSchema: context.rootSchema,
    nameRegistry: context.nameRegistry,
    path: `${context.path}/${pathSuffix}`,
    lookupPathName,
    lookupChildPathNames: context.lookupChildPathNames
  }
}
