import { capitalize, toJavaScriptName } from '../../utils.js'

export function getDefaultRootName ({ schema, rootName }) {
  return normalizeTypeName(rootName || schema?.title || 'Schema')
}

export function normalizeTypeName (value) {
  return capitalize(toJavaScriptName(String(value || 'Schema')))
}

export function joinTypeName ({ prefix = '', suffix = '' }) {
  return normalizeTypeName(`${prefix}${normalizeTypeName(suffix)}`)
}

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
