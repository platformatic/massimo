import { renderArrayType } from './array.js'
import { renderObjectType } from './object.js'
import { renderPrimitiveType } from './primitive.js'
import { renderReferenceType } from './reference.js'
import { renderIntersectionType, renderUnionType } from './union.js'

export function renderType ({ context }) {
  const { schema, nameRegistry, path, lookupPathName } = context

  if (lookupPathName) {
    const registeredName = nameRegistry.getPathName({ path })
    if (registeredName) {
      return registeredName
    }
  }

  if (schema.$ref) {
    return renderReferenceType({
      ref: schema.$ref,
      context,
      renderType
    })
  }

  const combinatorType = renderCombinatorType({ context, renderType })
  const objectType = hasObjectShape({ schema })
    ? renderObjectType({ context, renderType })
    : null

  if (objectType && combinatorType) {
    return `${objectType} & (${combinatorType})`
  }

  if (combinatorType) {
    return combinatorType
  }

  if (schema.type === 'array' || Array.isArray(schema.items)) {
    return renderArrayType({
      context,
      renderType
    })
  }

  if (objectType) {
    return objectType
  }

  if (schema.const !== undefined || Array.isArray(schema.enum) || Array.isArray(schema.type) || isPrimitiveSchemaType({ schema })) {
    return renderPrimitiveType({ schema })
  }

  return 'unknown'
}

function isPrimitiveSchemaType ({ schema }) {
  return ['string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)
}

function hasObjectShape ({ schema }) {
  return schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined || schema.patternProperties
}

function renderCombinatorType ({ context, renderType }) {
  if (Array.isArray(context.schema.oneOf) || Array.isArray(context.schema.anyOf)) {
    return renderUnionType({ context, renderType })
  }

  if (Array.isArray(context.schema.allOf)) {
    return renderIntersectionType({ context, renderType })
  }

  return null
}
