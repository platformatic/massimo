import { createChildRenderContext } from './render-context.js'

export function renderObjectType ({ context, renderType }) {
  const lines = buildObjectTypeLines({ context, renderType })

  if (lines.length === 0) {
    return '{}'
  }

  return `{
${lines.join('\n')}
}`
}

export function buildObjectTypeLines ({ context, renderType }) {
  const propertyLines = renderPropertyLines({ context, renderType })
  const indexLines = renderIndexSignatureLines({ context, renderType })
  return [...propertyLines, ...indexLines]
}

function renderPropertyLines ({ context, renderType }) {
  if (!isSchemaObject(context.schema.properties)) {
    return []
  }

  const requiredProperties = new Set(context.schema.required || [])

  return Object.entries(context.schema.properties).map(([propertyName, propertySchema]) => {
    const propertyType = renderType({
      context: createChildRenderContext({
        context,
        schema: propertySchema,
        pathSuffix: `properties/${propertyName}`
      })
    })

    return `  ${renderPropertyKey({ propertyName })}${requiredProperties.has(propertyName) ? '' : '?'}: ${propertyType};`
  })
}

function renderIndexSignatureLines ({ context, renderType }) {
  const lines = []

  if (context.schema.additionalProperties === true) {
    lines.push('  [key: string]: unknown;')
  }

  if (isSchemaObject(context.schema.additionalProperties)) {
    const valueType = renderType({
      context: createChildRenderContext({
        context,
        schema: context.schema.additionalProperties,
        pathSuffix: 'additionalProperties'
      })
    })

    lines.push(`  [key: string]: ${valueType};`)
  }

  if (isSchemaObject(context.schema.patternProperties)) {
    const patternTypes = Object.entries(context.schema.patternProperties).map(([pattern, patternSchema]) => {
      return renderType({
        context: createChildRenderContext({
          context,
          schema: patternSchema,
          pathSuffix: `patternProperties/${pattern}`,
          lookupPathName: false
        })
      })
    })

    if (patternTypes.length > 0) {
      lines.push(`  [key: string]: ${joinUniqueTypes({ types: patternTypes })};`)
    }
  }

  return dedupeLines({ lines })
}

function joinUniqueTypes ({ types }) {
  return [...new Set(types)].join(' | ')
}

function dedupeLines ({ lines }) {
  return [...new Set(lines)]
}

function renderPropertyKey ({ propertyName }) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)) {
    return propertyName
  }

  return JSON.stringify(propertyName)
}

function isSchemaObject (value) {
  return value !== null && typeof value === 'object'
}
