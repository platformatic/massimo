import jsonpointer from 'jsonpointer'

export function toRefPath (ref) {
  return typeof ref === 'string' && ref.startsWith('#') ? ref : '#'
}

export function getSchemaAtPath ({ schema, path }) {
  if (path === '#') {
    return schema
  }

  return jsonpointer.get(schema, path.slice(1))
}
