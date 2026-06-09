import { generateJSONSchemaTypes } from './json-schema/generator.js'

/**
 * Process a JSON Schema document and return the generated type output used by the CLI.
 */
export function processJSONSchema ({ schema, rootName }) {
  return generateJSONSchemaTypes({ schema, rootName })
}
