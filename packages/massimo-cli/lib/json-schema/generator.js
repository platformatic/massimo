import {
  buildDeclarations,
  canonicalizeDeclarationState,
  renderDeclarations
} from './declarations/index.js'
import { scanJSONSchema } from './core/index.js'

/**
 * Run the full JSON Schema to TypeScript declaration pipeline for a single schema document.
 */
export function generateJSONSchemaTypes ({ schema, rootName }) {
  // top-level pipeline is intentionally explicit to allow for isolated changes in each step.
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
