import jsonpointer from 'jsonpointer'
import { toSchemaRef } from './schema-names.js'

// The discriminator value of the `oneOf` member at `ref`: the `mapping` key that
// points at it (a mapping value is a `$ref` or a component name), else the
// component name, as OpenAPI defines the implicit mapping.
function discriminatorValue (discriminator, ref) {
  for (const [value, target] of Object.entries(discriminator.mapping ?? {})) {
    if ((target.startsWith('#') ? target : toSchemaRef(target)) === ref) {
      return value
    }
  }
  return ref.split('/').slice(-1).toString()
}

// Finds `name` among the properties of `schema` and of its `allOf` members,
// with whether any of them lists it as required.
function findProperty (schema, name, spec, seenRefs = new Set()) {
  if (schema.$ref) {
    if (seenRefs.has(schema.$ref)) return { required: false }
    seenRefs = new Set(seenRefs).add(schema.$ref)
    schema = jsonpointer.get(spec, schema.$ref.replace('#', '')) ?? {}
  }
  let property = schema.properties?.[name]
  let required = Array.isArray(schema.required) && schema.required.includes(name)
  for (const member of schema.allOf ?? []) {
    const found = findProperty(member, name, spec, seenRefs)
    property ??= found.property
    required ||= found.required
  }
  if (property?.$ref && !seenRefs.has(property.$ref)) {
    property = jsonpointer.get(spec, property.$ref.replace('#', ''))
  }
  return { property, required }
}

// A named `oneOf` member is printed as a bare type name, so the discriminator is
// narrowed by intersection, and only where the inline path would narrow it: a
// property typed as a plain string. One with an `enum` or `const` already
// carries its value, and intersecting it with another literal gives `never`.
function narrowNamedMember (typeName, ref, discriminator, spec) {
  const propertyName = discriminator.propertyName
  const { property, required } = findProperty({ $ref: ref }, propertyName, spec)
  if (!property || property.type !== 'string' || property.enum !== undefined || property.const !== undefined) {
    return typeName
  }
  const value = discriminatorValue(discriminator, ref).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `(${typeName} & { '${propertyName}'${required ? '' : '?'}: '${value}' })`
}

// `schemaNames` (from `buildSchemaNames`, only with `--named-schemas`) maps the
// `$ref` of each component schema to the type name it is declared under.
export function getType (typeDef, methodType, spec, seenRefs = new Set(), schemaNames) {
  if (typeDef.$ref) {
    // A named component is printed by its name, which also keeps recursive
    // schemas typed. Request positions keep inlining: there date formats widen
    // to `string | Date`, which the response-shaped declaration does not allow.
    const refName = methodType === 'req' ? undefined : schemaNames?.get(typeDef.$ref)
    if (refName) {
      return refName
    }
    if (seenRefs.has(typeDef.$ref)) {
      return 'unknown'
    }
    seenRefs = new Set(seenRefs)
    seenRefs.add(typeDef.$ref)
    typeDef = jsonpointer.get(spec, typeDef.$ref.replace('#', ''))
  }
  if (typeDef.schema) {
    return getType(typeDef.schema, methodType, spec, seenRefs, schemaNames)
  }
  if (typeDef.anyOf) {
    // recursively call this function
    const mapped = typeDef.anyOf.map(t => {
      return getType(t, methodType, spec, seenRefs, schemaNames)
    })
    return mapped.join(' | ')
  }

  if (typeDef.oneOf) {
    // recursively call this function
    const mapped = typeDef.oneOf.map(t => {
      return getType(t, methodType, spec, seenRefs, schemaNames)
    })

    if (typeDef.discriminator && typeDef.discriminator.propertyName) {
      const propertyName = typeDef.discriminator.propertyName
      // we do such conversion
      // from "{ 'type': string; 'meowSound': string }",
      // to   "{ 'type': 'Cat'; 'meowSound': string }",
      // where typeDef.discriminator.propertyName = 'type'

      // we support only an array of $ref values
      const mappedRefNames = typeDef.oneOf.map(t => {
        return t.$ref.split('/').slice(-1).toString()
      })
      return mapped
        .map((mappedObject, idx) => {
          // A named member is a bare type name: narrow the discriminator by intersection
          if (methodType !== 'req' && schemaNames?.has(typeDef.oneOf[idx].$ref)) {
            return narrowNamedMember(mappedObject, typeDef.oneOf[idx].$ref, typeDef.discriminator, spec)
          }
          const regexp = new RegExp(`'${propertyName}'[?]?: (string)`)

          const match = mappedObject.match(regexp)
          if (match) {
            const firstPart = mappedObject.substring(0, match.index)
            const l = match[0].length
            const secondPart = mappedObject.substring(match.index + l)
            const output = firstPart + match[0].replace('string', `'${mappedRefNames[idx]}'`) + secondPart
            return output
          }
          // otherwise we return the object as is
          return mappedObject
        })
        .join(' | ')
    }
    return mapped.join(' | ')
  }

  if (typeDef.allOf) {
    // recursively call this function
    return typeDef.allOf
      .map(t => {
        return getType(t, methodType, spec, seenRefs, schemaNames)
      })
      .join(' & ')
  }
  if (typeDef.type === 'array') {
    const nullable = typeDef.nullable
    return `Array<${getType(typeDef.items, methodType, spec, seenRefs, schemaNames)}>${nullable === true ? ' | null' : ''}`
  }
  if (typeDef.enum) {
    // Note: null type represented with an enum have no types and single enum element 'null'
    if (typeDef.type === undefined && typeDef.enum.includes('null')) {
      // Ignore `nullable` as it is implied by the enum
      return 'null'
    }
    const nullable = typeDef.nullable
    const chainedTypes = typeDef.enum
      .map(en => {
        // Quote by the runtime type of the value: the schema may omit `type`
        if (en === null) return 'null'
        if (typeof en === 'string') return `'${en.replace(/'/g, "\\'")}'`
        return en
      })
      .join(' | ')
    return nullable === true ? `${chainedTypes} | null` : chainedTypes
  }
  if (typeDef.type === 'object') {
    const additionalProps = typeDef?.additionalProperties
    const additionalPropsObj = additionalProps?.properties
    const additionalPropsType = additionalProps?.type
    const additionalPropsRequired = additionalProps?.required
    const nullable = typeDef.nullable
    const objProperties = typeDef.properties || additionalPropsObj
    if (!objProperties || Object.keys(objProperties).length === 0) {
      // Object without properties
      const resultType = additionalPropsType
        ? `Record<string, ${JSONSchemaToTsType({ type: additionalPropsType })}>`
        : 'object'
      return nullable === true ? `${resultType} | null` : resultType
    }

    let output = additionalPropsObj && additionalPropsType === 'object' ? 'Record<string, { ' : '{ '
    // TODO: add a test for objects without properties
    /* c8 ignore next 1 */
    const props = Object.keys(objProperties || {}).map(prop => {
      let required = false
      if (typeDef.required) {
        required = !!typeDef.required.includes(prop)
      }
      if (additionalPropsRequired) {
        required = required || !!additionalPropsRequired.includes(prop)
      }
      return `'${prop}'${required ? '' : '?'}: ${getType(objProperties[prop], methodType, spec, seenRefs, schemaNames)}`
    })
    if (additionalProps === true) {
      props.push('[key: string]: unknown')
    }
    output += props.join('; ')
    output += additionalPropsObj ? ' }>' : ' }'
    if (nullable === true) {
      output += ' | null'
    }
    return output
  }
  return JSONSchemaToTsType(typeDef, methodType)
}

function JSONSchemaToTsType ({ type, format, nullable }, methodType) {
  const isDateType = format === 'date' || format === 'date-time'
  let resultType = 'unknown'

  switch (type) {
    case 'string':
      resultType = isDateType && methodType === 'req' ? 'string | Date' : 'string'
      break
    case 'integer':
      resultType = 'number'
      break
    case 'number':
      resultType = 'number'
      break
    case 'boolean':
      resultType = 'boolean'
      break
    case 'null':
      // Remove duplication, no need to make it nullable later, return directly
      return 'null'
    // TODO what other types should we support here?
  }

  return nullable === true ? `${resultType} | null` : resultType
}
