import { buildDeclarations, renderDeclarations } from './declarations.js'
import { scanJSONSchema } from './scanner.js'

export function generateJSONSchemaTypes ({ schema, rootName }) {
  const state = scanJSONSchema({ schema, rootName })
  const declarations = buildDeclarations({ state })

  return {
    types: renderDeclarations({
      declarations,
      rootName: state.rootName
    })
  }
}
