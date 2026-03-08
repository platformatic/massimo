export function renderConstLiteralType ({ value }) {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function renderEnumLiteralType ({ value }) {
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "\\'")}'`
  }

  return String(value)
}

export function renderEnumType ({ values }) {
  return values.map(value => renderEnumLiteralType({ value })).join(' | ')
}

export function renderPrimitiveType ({ schema, singleQuoteConst = false }) {
  if (schema.const !== undefined) {
    if (singleQuoteConst && typeof schema.const === 'string') {
      return renderEnumLiteralType({ value: schema.const })
    }

    return renderConstLiteralType({ value: schema.const })
  }

  if (Array.isArray(schema.enum)) {
    return renderEnumType({ values: schema.enum })
  }

  if (Array.isArray(schema.type)) {
    return schema.type.map(typeName => mapJSONSchemaType({ typeName })).join(' | ')
  }

  return mapJSONSchemaType({ typeName: schema.type })
}

export function mapJSONSchemaType ({ typeName }) {
  switch (typeName) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    default:
      return 'unknown'
  }
}
