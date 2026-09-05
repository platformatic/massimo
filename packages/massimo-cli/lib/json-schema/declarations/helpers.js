import { normalizeTypeName } from '../core/naming.js'
import { getSchemaAtPath, toRefPath } from '../core/pointer.js'
import { getScannedSchemaAtPath } from '../core/scanner.js'
import { isOpenObjectSchema, isRecordObjectSchema } from '../render/object.js'

/**
 * Resolve the public declaration name for a path after canonical overrides have been applied.
 */
export function getPreferredPathName ({ path, state }) {
  return state.nameOverrides?.get(path) || state.nameRegistry.getPathName({ path }) || null
}

/**
 * Sort canonical paths deterministically so path processing never depends on traversal order.
 */
export function compareCanonicalPaths (left, right) {
  return left.length - right.length || left.localeCompare(right)
}

/**
 * Resolve `$ref` chains to the concrete schema used for declaration decisions.
 */
export function resolveDeclarationSchema ({ schema, state }) {
  let currentSchema = schema
  const visitedRefs = new Set()

  while (currentSchema?.$ref) {
    const refPath = toRefPath(currentSchema.$ref)
    if (visitedRefs.has(refPath)) {
      break
    }

    visitedRefs.add(refPath)
    currentSchema = getSchemaAtPath({ schema: state.rootSchema, path: refPath })
  }

  return currentSchema || schema
}

/**
 * Decide whether a schema should emit as an interface instead of a type alias.
 */
export function shouldUseInterface ({ schema }) {
  return hasObjectMembers({ schema }) &&
    !hasCombinator({ schema }) &&
    !isRecordObjectSchema({ schema }) &&
    !isOpenObjectSchema({ schema })
}

/**
 * Check whether a schema has any object-like structure that can emit members.
 */
export function hasObjectMembers ({ schema }) {
  return schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined || schema.patternProperties
}

/**
 * Check whether a schema contains a union or intersection combinator.
 */
export function hasCombinator ({ schema }) {
  return Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf) || Array.isArray(schema.allOf)
}

/**
 * Compute the owner scope used when reusing declarations inside union branches.
 */
export function getDeclarationOwnerScopePath ({ path }) {
  const valueMatch = path.match(/^(.*\/properties\/value)\/properties\/[^/]+$/)
  if (valueMatch) {
    return normalizeUnionBranchScopePath({ path: valueMatch[1] })
  }

  const branchMatch = path.match(/^(.*\/(?:oneOf|anyOf)\/\d+)\/properties\/[^/]+$/)
  if (branchMatch) {
    return normalizeUnionBranchScopePath({ path: branchMatch[1] })
  }

  return path.replace(/\/properties\/[^/]+$/, '')
}

/**
 * Collapse branch-specific paths into a wildcard form so sibling branches share the same scope.
 */
export function normalizeUnionBranchScopePath ({ path }) {
  return path.replace(/\/(oneOf|anyOf)\/\d+/g, '/$1/*')
}

/**
 * Return metadata for object-like unions whose branches can be emitted as named interfaces.
 */
export function getObjectUnionInfo ({ path, schema, state }) {
  const resolvedSchema = resolveDeclarationSchema({ schema, state })
  const members = resolvedSchema.oneOf || resolvedSchema.anyOf
  if (!Array.isArray(members) || members.length === 0) {
    return null
  }

  const branchPaths = members.map((_, index) => `${path}/${resolvedSchema.oneOf ? 'oneOf' : 'anyOf'}/${index}`)
  if (!branchPaths.every(branchPath => state.nameRegistry.hasPathName({ path: branchPath }))) {
    return null
  }

  const branchSchemas = branchPaths
    .map(branchPath => getScannedSchemaAtPath({ path: branchPath, state }))
    .filter(Boolean)

  if (!hasObjectMembers({ schema: resolvedSchema }) && !branchSchemas.every(branchSchema => hasObjectMembers({ schema: branchSchema }))) {
    return null
  }

  return {
    name: state.nameRegistry.getPathName({ path }),
    baseName: `Base${state.nameRegistry.getPathName({ path })}`,
    branchPaths
  }
}

/**
 * Check whether a path points at a property that lives inside a oneOf/anyOf branch.
 */
export function isUnionBranchPropertyPath ({ path }) {
  return /\/(?:oneOf|anyOf)\/\d+\/properties\/[^/]+$/.test(path)
}

/**
 * Check whether an array path has both a named array type and a separately named item type.
 */
export function isNamedArrayPath ({ path, state, schema }) {
  if (!state.nameRegistry.hasPathName({ path }) || !schema?.items || Array.isArray(schema.items)) {
    return false
  }

  return state.nameRegistry.hasPathName({ path: `${path}/items` })
}

/**
 * Apply the declaration layer's simple singularization rules to an already-normalized name.
 */
export function singularizeName ({ name }) {
  if (!name) {
    return name
  }

  if (name.endsWith('ies')) {
    return `${name.slice(0, -3)}y`
  }

  if (name.endsWith('ses')) {
    return name.slice(0, -2)
  }

  if (name.endsWith('s') && name.length > 1) {
    return name.slice(0, -1)
  }

  return name
}

/**
 * Pick the local name prefix used when renaming nested union branch declarations.
 */
export function getUnionLocalPrefix ({ path, localRootName, state }) {
  if (isItemPath(path)) {
    return localRootName
  }

  const propertyName = getPropertyNameFromPath({ path })
  if (propertyName) {
    return normalizeTypeName(propertyName)
  }

  return localRootName
}

/**
 * Extract the final property segment from a schema path.
 */
export function getPropertyNameFromPath ({ path }) {
  const match = path.match(/\/properties\/([^/]+)$/)
  return match ? match[1] : null
}

/**
 * Check whether a path represents an array item schema.
 */
export function isItemPath (path) {
  return /\/items$/.test(path)
}

/**
 * Check whether a path is the top-level item type for a root array property.
 */
export function isTopLevelArrayItemPath ({ path }) {
  return /^#\/properties\/[^/]+\/items$/.test(path)
}

/**
 * Decide whether an omitted base-union property still needs its own public declaration.
 */
export function shouldEmitOmittedUnionPropertyDeclaration ({ path, propertyName, hasBaseProperties = false }) {
  if (propertyName !== 'type') {
    return true
  }

  return path === '#' || (!hasBaseProperties && isTopLevelArrayItemPath({ path }))
}

/**
 * Build the deterministic structural reuse key used for conservative declaration aliasing.
 */
export function getDeclarationSchemaReuseKey ({ schema }) {
  if (!schema || typeof schema !== 'object' || schema.$ref) {
    return null
  }

  return JSON.stringify(simplifyDeclarationSchema({ schema }))
}

/**
 * Check whether a schema is represented as a scalar literal or primitive alias.
 */
export function isScalarSchema ({ schema }) {
  if (!schema || typeof schema !== 'object') {
    return false
  }

  if (schema.const !== undefined || Array.isArray(schema.enum)) {
    return true
  }

  return ['string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)
}

/**
 * Check whether a schema is an array of scalar values that can still carry a named item type.
 */
export function isNamedScalarArraySchema ({ schema }) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema.items)) {
    return false
  }

  return schema.type === 'array' && isScalarSchema({ schema: schema.items })
}

/**
 * Limit structural alias reuse to scalar schemas that are safe to collapse globally.
 */
export function isReusableScalarSchema ({ schema }) {
  return Array.isArray(schema?.enum)
}

/**
 * Check whether a path points at a scalar field inside a union branch `value` object.
 */
export function isValueBranchScalarPath ({ path }) {
  return /\/(?:oneOf|anyOf)\/\d+\/properties\/value\/properties\/[^/]+$/.test(path)
}

/**
 * Derive a deterministic nested array item name from the owning branch and property name.
 */
export function getNestedArrayItemName ({ branchName, propertyName }) {
  const propertyTypeName = normalizeTypeName(propertyName)

  if (branchName.endsWith(propertyTypeName)) {
    return singularizeName({ name: branchName })
  }

  return `${branchName}${singularizeName({ name: propertyTypeName })}`
}

/**
 * Decide whether repeated root-branch properties should collapse to a shared owner-level name.
 */
export function shouldUseRootUnionPropertyName ({ entries }) {
  if (entries.length === 0) {
    return false
  }

  if (!entries.every(entry => hasObjectMembers({ schema: entry.schema }))) {
    return false
  }

  const uniqueKeys = [...new Set(entries.map(entry => entry.key).filter(Boolean))]
  if (uniqueKeys.length === 1 && entries.length > 1) {
    return true
  }

  return entries.every(entry => !entry.schema?.title && !entry.schema?.description)
}

/**
 * Reduce a schema to the fields that influence declaration identity and structural reuse.
 */
export function simplifyDeclarationSchema ({ schema }) {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const simplified = {}

  for (const key of ['title', 'description', 'type', 'format', 'pattern', 'minimum', 'const']) {
    if (schema[key] !== undefined) {
      simplified[key] = schema[key]
    }
  }

  if (Array.isArray(schema.enum)) {
    simplified.enum = [...schema.enum]
  }

  if (Array.isArray(schema.required)) {
    simplified.required = [...schema.required]
  }

  if (schema.properties && typeof schema.properties === 'object') {
    simplified.properties = Object.keys(schema.properties).sort().reduce((acc, key) => {
      acc[key] = simplifyDeclarationSchema({ schema: schema.properties[key] })
      return acc
    }, {})
  }

  if (schema.items) {
    simplified.items = Array.isArray(schema.items)
      ? schema.items.map(item => simplifyDeclarationSchema({ schema: item }))
      : simplifyDeclarationSchema({ schema: schema.items })
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    simplified.additionalProperties = simplifyDeclarationSchema({ schema: schema.additionalProperties })
  } else if (schema.additionalProperties !== undefined) {
    simplified.additionalProperties = schema.additionalProperties
  }

  if (schema.patternProperties && typeof schema.patternProperties === 'object') {
    simplified.patternProperties = Object.keys(schema.patternProperties).sort().reduce((acc, key) => {
      acc[key] = simplifyDeclarationSchema({ schema: schema.patternProperties[key] })
      return acc
    }, {})
  }

  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) {
      simplified[key] = schema[key].map(member => simplifyDeclarationSchema({ schema: member }))
    }
  }

  return simplified
}

/**
 * Compute the prefix used when flattening child container names under an owner declaration.
 */
export function getCollapsedOwnerPrefix ({ typeName, propertyName }) {
  if (!typeName || !propertyName) {
    return null
  }

  const propertyTypeName = normalizeTypeName(propertyName)
  if (typeName.endsWith(propertyTypeName)) {
    const prefix = typeName.slice(0, -propertyTypeName.length)
    return prefix || typeName
  }

  return typeName
}

/**
 * Decide whether a container property's direct children should inherit a flatter owner-prefixed name.
 */
export function shouldCollapseDirectContainerChildren ({ propertyName, schema }) {
  if (!schema?.properties || schema.type !== 'object') {
    return false
  }

  if (isContainerPropertyName({ propertyName })) {
    return true
  }

  return Object.values(schema.properties).some(propertySchema => {
    return hasObjectMembers({ schema: propertySchema }) ||
      (propertySchema?.type === 'array' && !Array.isArray(propertySchema.items))
  })
}

/**
 * Build a flattened child declaration name for container-owned helper types.
 */
export function buildCollapsedChildName ({ ownerPrefix, propertyName, schema, fallbackName, singular = false }) {
  if (!ownerPrefix || !propertyName) {
    return fallbackName || null
  }

  let suffix = getCollapsedChildSuffix({ ownerPrefix, propertyName, schema })
  if (singular) {
    suffix = singularizeName({ name: suffix })
  }

  return `${ownerPrefix}${suffix}` || fallbackName || null
}

/**
 * Compute the suffix appended to a flattened container child declaration name.
 */
export function getCollapsedChildSuffix ({ ownerPrefix, propertyName, schema }) {
  let suffix = normalizeTypeName(propertyName)
  if (hasObjectMembers({ schema }) && suffix.startsWith('Default') && suffix.length > 'Default'.length) {
    suffix = suffix.slice('Default'.length)
  }

  const ownerTail = ownerPrefix.split(/(?=[A-Z])/).at(-1)
  if (ownerTail && suffix.startsWith(ownerTail) && suffix.length > ownerTail.length) {
    suffix = suffix.slice(ownerTail.length)
  }

  return suffix
}

/**
 * Check whether a property name represents a generic container that should flatten its children.
 */
export function isContainerPropertyName ({ propertyName }) {
  const normalizedName = normalizeTypeName(propertyName || '')
  return normalizedName.endsWith('Config') || normalizedName.endsWith('Category')
}

/**
 * Return a property map without the names that were omitted from a union base schema.
 */
export function omitProperties ({ properties, omittedPropertyNames }) {
  if (!properties) {
    return properties
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([propertyName]) => !omittedPropertyNames.has(propertyName))
  )
}
