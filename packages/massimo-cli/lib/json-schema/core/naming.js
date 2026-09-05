import { capitalize, toJavaScriptName } from '../../utils.js'

/**
 * Resolve the root type name, preferring an explicit override and then schema metadata.
 */
export function getDefaultRootName ({ schema, rootName }) {
  return normalizeTypeName(rootName || schema?.title || 'Schema')
}

/**
 * Convert an arbitrary schema-derived label into a TypeScript-friendly public type name.
 */
export function normalizeTypeName (value) {
  return capitalize(toJavaScriptName(String(value || 'Schema')))
}

/**
 * Join a parent prefix and child suffix into a normalized type name.
 */
export function joinTypeName ({ prefix = '', suffix = '' }) {
  return normalizeTypeName(`${prefix}${normalizeTypeName(suffix)}`)
}

/**
 * Apply the generator's simple singularization rules when deriving array item type names.
 */
export function singularizeTypeName (value) {
  const normalized = normalizeTypeName(value)

  if (normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`
  }

  if (normalized.endsWith('ses')) {
    return normalized.slice(0, -2)
  }

  if (normalized.endsWith('s') && normalized.length > 1) {
    return normalized.slice(0, -1)
  }

  return normalized
}
