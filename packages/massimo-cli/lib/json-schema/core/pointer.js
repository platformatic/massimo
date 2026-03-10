import jsonpointer from 'jsonpointer'

/**
 * Normalize an internal JSON Schema reference string into the path form used by the generator.
 */
export function toRefPath (ref) {
  return typeof ref === 'string' && ref.startsWith('#') ? ref : '#'
}

/**
 * Resolve a schema node from a normalized generator path.
 */
export function getSchemaAtPath ({ schema, path }) {
  if (path === '#') {
    return schema
  }

  return jsonpointer.get(schema, path.slice(1))
}
