import { normalizeTypeName } from './core/naming.js'

/**
 * Collect comment lines for a schema node from the metadata that should be exposed in the output.
 */
export function getCommentLines ({ schema, name }) {
  if (!schema || typeof schema !== 'object') {
    return null
  }

  const lines = []

  if (schema.title && normalizeTypeName(schema.title) !== name) {
    lines.push(schema.title)
  }

  if (schema.description) {
    lines.push(...schema.description.split('\n').filter(Boolean))
  }

  if (schema.format) {
    lines.push(`Expected format: JSON Schema ${schema.format}`)
  }

  if (schema.pattern) {
    lines.push(`Expected pattern: ${schema.pattern}`)
  }

  if (schema.minimum !== undefined) {
    lines.push(`Expected minimum: ${schema.minimum}`)
  }

  return lines.length > 0 ? lines : null
}

/**
 * Render a JSDoc block from precomputed comment lines.
 */
export function renderCommentBlock ({ lines, indent = '' }) {
  return [
    `${indent}/**`,
    ...lines.map(line => `${indent} * ${line}`),
    `${indent} */`
  ]
}
