const SCHEMA_REF_PREFIX = '#/components/schemas/'

// Names a component schema cannot be declared as: TypeScript keywords and
// built-in type names, plus the global and imported types the generated
// declarations refer to (a schema called `Array` would shadow `Array<T>`).
const RESERVED_TYPE_NAMES = new Set([
  // type keywords
  'any', 'bigint', 'boolean', 'never', 'null', 'number', 'object', 'string', 'symbol', 'undefined', 'unknown', 'void',
  // reserved words
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else',
  'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
  'instanceof', 'interface', 'let', 'new', 'package', 'private', 'protected', 'public', 'return', 'static', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'while', 'with', 'yield',
  // global types used by the generated declarations
  'Array', 'Blob', 'Date', 'FormData', 'Omit', 'Promise', 'Record', 'RequestInit',
  // types declared or imported by every generated file
  'FullResponse', 'GetHeadersOptions', 'PlatformaticClientOptions',
  'StatusCode1xx', 'StatusCode2xx', 'StatusCode3xx', 'StatusCode4xx', 'StatusCode5xx'
])

// The `$ref` that points at a component schema key (JSON pointer escaping).
export function toSchemaRef (key) {
  return SCHEMA_REF_PREFIX + key.replace(/~/g, '~0').replace(/\//g, '~1')
}

// Converts a component schema key into a TypeScript identifier. Letters and
// digits of any script are kept, as TypeScript identifiers allow them.
export function toTypeName (key) {
  if (/^[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D]*$/u.test(key)) {
    return key
  }
  const name = key
    .split(/(?:[^\p{ID_Continue}]|_)+/u)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return name && !/^\p{ID_Start}/u.test(name) ? `Schema${name}` : name || 'Schema'
}

// Assigns a unique type name to every `components.schemas` entry and returns a
// Map from its `$ref` to that name. `takenNames` are the names the generator
// declares itself (operation request/response types, the client type): they
// always keep their name. Keys that are already identifiers claim their name
// first, then converted keys; a schema whose name is still taken or reserved
// gets the suffix `Schema`, then `Schema2`, `Schema3`, ... in spec order. The
// result only depends on the spec, so the output is stable between runs.
export function buildSchemaNames (spec, takenNames = []) {
  const schemaNames = new Map()
  const schemas = spec.components?.schemas
  if (!schemas) return schemaNames

  const keys = Object.keys(schemas)
  const taken = new Set([...RESERVED_TYPE_NAMES, ...takenNames])
  const assigned = new Map()
  const claim = key => {
    const name = toTypeName(key)
    if (!taken.has(name)) {
      taken.add(name)
      assigned.set(key, name)
    }
  }
  keys.filter(key => toTypeName(key) === key).forEach(claim)
  keys.filter(key => toTypeName(key) !== key).forEach(claim)
  for (const key of keys) {
    if (assigned.has(key)) continue
    const base = `${toTypeName(key)}Schema`
    let name = base
    for (let i = 2; taken.has(name); i++) {
      name = `${base}${i}`
    }
    taken.add(name)
    assigned.set(key, name)
  }
  for (const [key, name] of assigned) {
    schemaNames.set(toSchemaRef(key), name)
  }
  return schemaNames
}
