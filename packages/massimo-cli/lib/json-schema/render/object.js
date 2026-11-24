import { getCommentLines, renderCommentBlock } from '../comments.js'
import { createChildRenderContext } from './render-context.js'
import { shouldInlineNamedScalarPropertyType } from '../core/scanner.js'

/**
 * Render an object-like schema as either an interface body, a record, or an open object fallback.
 */
export function renderObjectType ({ context, renderType }) {
  if (isRecordObjectSchema({ schema: context.schema })) {
    return renderRecordType({ context, renderType })
  }

  if (isOpenObjectSchema({ schema: context.schema })) {
    return 'Record<string, unknown>'
  }

  const lines = buildObjectTypeLines({ context, renderType })

  if (lines.length === 0) {
    return '{}'
  }

  return `{
${lines.join('\n')}
}`
}

/**
 * Identify object schemas that are better represented as `Record<string, T>`.
 */
export function isRecordObjectSchema ({ schema }) {
  const hasProperties = isSchemaObject(schema.properties) && Object.keys(schema.properties).length > 0
  const hasPatternProperties = isSchemaObject(schema.patternProperties) && Object.keys(schema.patternProperties).length > 0
  const hasAdditionalPropertiesObject = isSchemaObject(schema.additionalProperties)

  return !hasProperties && (hasPatternProperties || hasAdditionalPropertiesObject)
}

/**
 * Identify open object schemas with no explicit members that should fall back to a generic record.
 */
export function isOpenObjectSchema ({ schema }) {
  if (schema?.type !== 'object') {
    return false
  }

  const hasProperties = isSchemaObject(schema.properties) && Object.keys(schema.properties).length > 0
  const hasPatternProperties = isSchemaObject(schema.patternProperties) && Object.keys(schema.patternProperties).length > 0

  return !hasProperties && !hasPatternProperties && schema.additionalProperties !== false
}

function renderRecordType ({ context, renderType }) {
  const valueTypes = []

  if (isSchemaObject(context.schema.additionalProperties)) {
    valueTypes.push(renderType({
      context: createChildRenderContext({
        context,
        schema: context.schema.additionalProperties,
        pathSuffix: 'additionalProperties',
        lookupPathName: false
      })
    }))
  }

  if (isSchemaObject(context.schema.patternProperties)) {
    for (const [pattern, patternSchema] of Object.entries(context.schema.patternProperties)) {
      valueTypes.push(renderType({
        context: createChildRenderContext({
          context,
          schema: patternSchema,
          pathSuffix: `patternProperties/${pattern}`,
          lookupPathName: false
        })
      }))
    }
  }

  const valueType = joinUniqueTypes({ types: valueTypes }) || 'unknown'
  return `Record<string, ${valueType}>`
}

/**
 * Build the property and index-signature lines that make up an object declaration body.
 */
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
  const lines = []

  for (const [propertyName, propertySchema] of Object.entries(context.schema.properties)) {
    const propertyPath = `${context.path}/properties/${propertyName}`
    if (shouldInlineNamedScalarPropertyType({ path: propertyPath, schema: propertySchema, state: context })) {
      const commentLines = getCommentLines({
        schema: propertySchema,
        name: null
      })

      if (commentLines) {
        lines.push(...renderCommentBlock({ lines: commentLines, indent: '  ' }))
      }
    }

    const propertyType = renderType({
      context: createChildRenderContext({
        context,
        schema: propertySchema,
        pathSuffix: `properties/${propertyName}`
      })
    })

    lines.push(`  ${renderPropertyKey({ propertyName })}${requiredProperties.has(propertyName) ? '' : '?'}: ${propertyType};`)
  }

  return lines
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
