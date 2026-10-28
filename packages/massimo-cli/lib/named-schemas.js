import jsonpointer from 'jsonpointer'
import { getType } from './get-type.js'
import { toSchemaRef, toTypeName } from './schema-names.js'

// An object schema with properties is declared as an interface; everything else
// (unions, arrays, scalars, nullable objects, records) as a type alias.
function isInterfaceSchema (schema) {
  return (
    schema.type === 'object' &&
    schema.nullable !== true &&
    !schema.allOf &&
    !schema.anyOf &&
    !schema.oneOf &&
    schema.properties !== undefined &&
    Object.keys(schema.properties).length > 0 &&
    !(schema.additionalProperties && typeof schema.additionalProperties === 'object' && schema.additionalProperties.properties)
  )
}

// `allOf` of named object schemas (plus at most one inline object) becomes
// `interface X extends A, B { ...inline }`, which the compiler caches by name.
// It is only used when no property is declared by two members: an interface
// that restates a parent property with another type or optionality does not
// compile (TS2430), nor does one whose parents disagree on a property (TS2320).
// Otherwise the schema is declared as the `A & B & {...}` alias.
function writeAllOfInterface (writer, name, schema, spec, schemaNames) {
  const parents = []
  const inline = []
  const declared = new Set()
  const declareOnce = member => Object.keys(member.properties).every(prop => !declared.has(prop) && declared.add(prop))
  for (const member of schema.allOf) {
    const parentName = member.$ref && schemaNames.get(member.$ref)
    if (parentName) {
      const parent = jsonpointer.get(spec, member.$ref.replace('#', ''))
      if (!parent || !isInterfaceSchema(parent) || !declareOnce(parent)) return false
      parents.push(parentName)
    } else if (isInterfaceSchema(member) && declareOnce(member)) {
      inline.push(member)
    } else {
      return false
    }
  }
  if (parents.length === 0 || inline.length > 1 || schema.nullable === true) return false
  const body = inline.length === 1 ? getType(inline[0], 'res', spec, undefined, schemaNames) : '{}'
  writer.writeLine(`export interface ${name} extends ${parents.join(', ')} ${body}`)
  return true
}

const KEY_ESCAPES = { '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', '\u2028': '\\u2028', '\u2029': '\\u2029' }

// A schema key is printed inside a line comment: a line terminator would end it.
function escapeKey (key) {
  return key.replace(/[\\'\n\r\u2028\u2029]/g, char => KEY_ESCAPES[char])
}

// A description is printed inside a JSDoc block: `*/` would close it early.
function escapeComment (text) {
  return text.replace(/\*\//g, '*\\/')
}

// The component refs a schema names in a direct position: itself a `$ref`, or a
// member of `anyOf`, `oneOf` or `allOf`, at any depth of those, but never inside
// an object or an array.
function directRefs (schema, schemaNames, refs = new Set()) {
  if (schema.$ref) {
    if (schemaNames.has(schema.$ref)) refs.add(schema.$ref)
    return refs
  }
  for (const member of [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
    directRefs(member, schemaNames, refs)
  }
  return refs
}

// The refs that close a cycle of direct references back to `ref`, `ref`
// included: declared by name, `type A = B | string` with `type B = A | number`
// is circular (TS2456). Empty when the schema is not on such a cycle.
function circularRefs (ref, spec, schemaNames) {
  const edges = from => directRefs(jsonpointer.get(spec, from.replace('#', '')) ?? {}, schemaNames)
  const reach = from => {
    const seen = new Set()
    const stack = [...edges(from)]
    while (stack.length > 0) {
      const next = stack.pop()
      if (seen.has(next)) continue
      seen.add(next)
      stack.push(...edges(next))
    }
    return seen
  }
  const reachable = reach(ref)
  if (!reachable.has(ref)) return new Set()
  return new Set([...reachable].filter(other => other === ref || reach(other).has(ref)))
}

// Writes one declaration per `components.schemas` entry, in spec order, under
// the names assigned by `buildSchemaNames`.
export function writeNamedSchemas (writer, spec, schemaNames) {
  const schemas = spec.components?.schemas
  if (!schemas) return
  for (const [key, schema] of Object.entries(schemas)) {
    const name = schemaNames.get(toSchemaRef(key))
    if (name !== toTypeName(key)) {
      writer.writeLine(`// components.schemas['${escapeKey(key)}'] is declared as ${name}: its own name is taken`)
    }
    if (schema.description) {
      writer.writeLine('/**')
      for (const line of schema.description.split('\n')) {
        writer.writeLine(` * ${escapeComment(line)}`)
      }
      writer.writeLine(' */')
    }
    if (schema.allOf && writeAllOfInterface(writer, name, schema, spec, schemaNames)) {
      continue
    }
    if (isInterfaceSchema(schema)) {
      writer.writeLine(`export interface ${name} ${getType(schema, 'res', spec, undefined, schemaNames)}`)
      continue
    }
    // A schema on a cycle of direct references inlines the cycle, and its own
    // ref becomes `unknown` there, as without `--named-schemas`
    const ref = toSchemaRef(key)
    const circular = circularRefs(ref, spec, schemaNames)
    const body = circular.size > 0
      ? getType(schema, 'res', spec, new Set([ref]), schemaNames, circular)
      : getType(schema, 'res', spec, undefined, schemaNames)
    writer.writeLine(`export type ${name} = ${body}`)
  }
  writer.blankLine()
}
