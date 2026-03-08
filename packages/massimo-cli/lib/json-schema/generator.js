import {
  buildDeclarations,
  canonicalizeDeclarationState,
  renderDeclarations
} from './declarations/index.js'
import { scanJSONSchema } from './core/index.js'

export function generateJSONSchemaTypes ({ schema, rootName }) {
  const scannedState = scanJSONSchema({ schema, rootName })
  const canonicalState = canonicalizeDeclarationState({ state: scannedState })
  const declarations = buildDeclarations({ state: canonicalState })

  return {
    types: renderDeclarations({
      declarations,
      rootName: canonicalState.rootName
    })
  }
}
