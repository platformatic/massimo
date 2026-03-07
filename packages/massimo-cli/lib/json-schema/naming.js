import { capitalize, toJavaScriptName } from '../utils.js'

export function getDefaultRootName ({ schema, rootName }) {
  return normalizeTypeName(rootName || schema?.title || 'Schema')
}

export function normalizeTypeName (value) {
  return capitalize(toJavaScriptName(String(value || 'Schema')))
}

export function joinTypeName ({ prefix = '', suffix = '' }) {
  return normalizeTypeName(`${prefix}${normalizeTypeName(suffix)}`)
}
