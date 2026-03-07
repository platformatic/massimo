import { generateJSONSchemaTypes } from './json-schema/generator.js'

export function processJSONSchema ({ schema, rootName }) {
  return generateJSONSchemaTypes({ schema, rootName })
}
