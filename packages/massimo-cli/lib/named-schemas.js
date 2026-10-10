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
    const body = getType(schema, 'res', spec, undefined, schemaNames)
    if (isInterfaceSchema(schema)) {
      writer.writeLine(`export interface ${name} ${body}`)
    } else {
      writer.writeLine(`export type ${name} = ${body}`)
    }
  }
  writer.blankLine()
}
