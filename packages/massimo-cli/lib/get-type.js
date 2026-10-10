import jsonpointer from 'jsonpointer'
import { toSchemaRef } from './schema-names.js'

// Prints a string as a single-quoted TypeScript literal.
function quote (value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

// The discriminator values of the `oneOf` member at `ref`: every `mapping` key
// that points at it (a mapping value is a `$ref` or a component name), else the
// component name, as OpenAPI defines the implicit mapping.
function discriminatorValues (discriminator, ref) {
  const values = Object.entries(discriminator.mapping ?? {})
    .filter(([, target]) => (target.startsWith('#') ? target : toSchemaRef(target)) === ref)
    .map(([value]) => value)
  return values.length > 0 ? values : [ref.split('/').slice(-1).toString()]
}

// Collects every definition of the property `name` along the `$ref` and `allOf`
// chain of `schema`, with whether any member lists it as required.
function findProperty (schema, name, spec, seenRefs = new Set()) {
  if (schema.$ref) {
    if (seenRefs.has(schema.$ref)) return { definitions: [], required: false }
    seenRefs = new Set(seenRefs).add(schema.$ref)
    schema = jsonpointer.get(spec, schema.$ref.replace('#', '')) ?? {}
  }
  const definitions = []
  let required = Array.isArray(schema.required) && schema.required.includes(name)
  const own = schema.properties?.[name]
  if (own) {
    definitions.push(own.$ref ? jsonpointer.get(spec, own.$ref.replace('#', '')) ?? {} : own)
  }
  for (const member of schema.allOf ?? []) {
    const found = findProperty(member, name, spec, seenRefs)
    definitions.push(...found.definitions)
    required ||= found.required
  }
  return { definitions, required }
}

function isPlainString (schema) {
  return schema.type === 'string' && schema.enum === undefined && schema.const === undefined
}

// A named `oneOf` member is printed as a bare type name, so the discriminator is
// narrowed by intersection, and only where the inline path would narrow it: a
// property typed as a plain string by every member that declares it. One with
// an `enum` or `const` anywhere along its `allOf` chain already carries its
// value, and intersecting it with another literal gives `never`.
function narrowNamedMember (typeName, ref, discriminator, spec) {
  const propertyName = discriminator.propertyName
  const { definitions, required } = findProperty({ $ref: ref }, propertyName, spec)
  if (definitions.length === 0 || !definitions.every(isPlainString)) {
    return typeName
  }
  const values = discriminatorValues(discriminator, ref).map(quote).join(' | ')
  return `(${typeName} & { '${propertyName}'${required ? '' : '?'}: ${values} })`
}

// `schemaNames` (from `buildSchemaNames`, only with `--named-schemas`) maps the
// `$ref` of each component schema to the type name it is declared under.
// `inlineRefs` are refs that must not be printed by name until the type passes
// through an object or an array: a type alias that names itself directly in a
// union or intersection is circular (TS2456), so its declaration inlines them.
export function getType (typeDef, methodType, spec, seenRefs = new Set(), schemaNames, inlineRefs) {
  if (typeDef.$ref) {
    // A named component is printed by its name, which also keeps recursive
    // schemas typed. Request positions keep inlining: there date formats widen
    // to `string | Date`, which the response-shaped declaration does not allow.
    const refName = methodType === 'req' || inlineRefs?.has(typeDef.$ref) ? undefined : schemaNames?.get(typeDef.$ref)
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
    return getType(typeDef.schema, methodType, spec, seenRefs, schemaNames, inlineRefs)
  }
  if (typeDef.anyOf) {
    // recursively call this function
    const mapped = typeDef.anyOf.map(t => {
      return getType(t, methodType, spec, seenRefs, schemaNames, inlineRefs)
    })
    return mapped.join(' | ')
  }

  if (typeDef.oneOf) {
    // recursively call this function
    const mapped = typeDef.oneOf.map(t => {
      return getType(t, methodType, spec, seenRefs, schemaNames, inlineRefs)
    })

    if (typeDef.discriminator && typeDef.discriminator.propertyName) {
      const propertyName = typeDef.discriminator.propertyName
      // we do such conversion
      // from "{ 'type': string; 'meowSound': string }",
      // to   "{ 'type': 'Cat'; 'meowSound': string }",
      // where typeDef.discriminator.propertyName = 'type'

      // the value is the name of the $ref, so an inline member is left as is
      const mappedRefNames = typeDef.oneOf.map(t => {
        return t.$ref?.split('/').slice(-1).toString()
      })
      return mapped
        .map((mappedObject, idx) => {
          // A named member is a bare type name: narrow the discriminator by intersection
          if (mappedRefNames[idx] === undefined) {
            return mappedObject
          }
          if (methodType !== 'req' && schemaNames?.has(typeDef.oneOf[idx].$ref) && !inlineRefs?.has(typeDef.oneOf[idx].$ref)) {
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
        return getType(t, methodType, spec, seenRefs, schemaNames, inlineRefs)
      })
      .join(' & ')
  }
  if (typeDef.type === 'array') {
    const nullable = typeDef.nullable
    // `--named-schemas` declares every component, also those the default output
    // never reaches, so a missing `items` is read as `{}`, any item. Without it
    // the default output is left as it was.
    const items = typeDef.items ?? (schemaNames ? {} : undefined)
    return `Array<${getType(items, methodType, spec, seenRefs, schemaNames)}>${nullable === true ? ' | null' : ''}`
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
