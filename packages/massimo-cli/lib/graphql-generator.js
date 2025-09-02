import CodeBlockWriter from 'code-block-writer'
import { UnknownTypeError } from './errors.js'
import { capitalize, toJavaScriptName } from './utils.js'

export function processGraphQL ({ schema, name, folder, url, moduleFormat }) {
  schema = schema.__schema
  return {
    types: generateTypesFromGraphQL({ schema, name }),
    implementation: generateImplementationFromGraqhQL({ schema, name, url, moduleFormat })
  }
}

const skip = new Set(['Query', 'Mutation', 'Subscription', 'Boolean', 'String'])

function generateTypesFromGraphQL ({ schema, name }) {
  const camelcasedName = toJavaScriptName(name)

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  const functionName = `generate${capitalize(camelcasedName)}Client`

  writer.writeLine("import { type PlatformaticClientOptions } from 'massimo'")
  writer.blankLine()

  writer.write('interface GraphQLQueryOptions').block(() => {
    writer.writeLine('query: string;')
    writer.writeLine('headers: Record<string, string>;')
    writer.writeLine('variables: Record<string, unknown>;')
  })

  writer.write('interface GraphQLClient').block(() => {
    writer.writeLine('graphql<T>(options: GraphQLQueryOptions): PromiseLike<T>;')
  })
  writer.blankLine()

  for (const type of schema.types) {
    if (type.kind === 'OBJECT' && type.name.indexOf('__') === -1 && !skip.has(type.name)) {
      const capitalizedName = capitalize(type.name)
      writer.write(`export interface ${capitalizedName}`).block(() => {
        const addedProps = new Set()
        for (const field of type.fields) {
          writeProperty(writer, field.name, field.type, addedProps)
        }
      })
    }
  }

  writer.write('interface GraphQLClient').block(() => {
    writer.writeLine('graphql<T>(GraphQLQuery): Promise<T>;')
  })

  writer.blankLine()
  writer.writeLine(`export function ${functionName}(opts: PlatformaticClientOptions): Promise<GraphQLClient>;`)
  writer.writeLine(`export default ${functionName};`)

  return writer.toString()
}

function generateImplementationFromGraqhQL ({ name, url, moduleFormat }) {
  const camelcasedName = toJavaScriptName(name)
  const isESM = moduleFormat === 'esm'

  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })

  if (isESM) {
    writer.writeLine("import { buildGraphQLClient } from 'massimo'")
    writer.writeLine("import { join } from 'node:path'")
  } else {
    writer.writeLine("const { buildGraphQLClient } = require('massimo')")
    writer.writeLine("const { join } = require('node:path')")
  }
  writer.blankLine()

  url = new URL(url)

  const functionName = `generate${capitalize(camelcasedName)}Client`
  const funcDecl = isESM ? `export async function ${functionName} (opts)` : `async function ${functionName} (opts)`
  writer.write(funcDecl).block(() => {
    writer.writeLine('const url = new URL(opts.url)')
    writer.writeLine(`url.pathname = '${url.pathname}'`)
    writer.write('return buildGraphQLClient(').inlineBlock(() => {
      writer.writeLine("type: 'graphql',")
      writer.writeLine(`name: '${camelcasedName}',`)
      const pathExpr = isESM ? `join(import.meta.dirname, '${name}.schema.graphql')` : `join(__dirname, '${name}.schema.graphql')`
      writer.writeLine(`path: ${pathExpr},`)
      writer.writeLine('serviceId: opts.serviceId,')
      writer.writeLine('url: url.toString()')
    })
    writer.write(')')
  })
  writer.blankLine()
  if (isESM) {
    writer.writeLine(`export default ${functionName}`)
  } else {
    writer.writeLine(`module.exports = ${functionName}`)
    writer.writeLine(`module.exports.default = ${functionName}`)
    writer.writeLine(`module.exports.${functionName} = ${functionName}`)
  }
  return writer.toString()
}

function GraphQLScalarToTsType (type) {
  switch (type) {
    case 'String':
      return 'string'
    case 'ID':
      return 'string'
    case 'Int':
      return 'number'
    case 'Float':
      return 'number'
    case 'Date':
      return 'string'
    case 'DateTime':
      return 'string'
    // TODO test other scalar types
    /* c8 ignore next 3 */
    default:
      throw new UnknownTypeError(type)
  }
}

function writeProperty (writer, key, value, addedProps) {
  addedProps.add(key)
  writer.quote(key)
  writer.write('?')
  if (value.kind === 'SCALAR') {
    writer.write(`: ${GraphQLScalarToTsType(value.name)};`)
    writer.newLine()
  } else if (value.kind === 'LIST') {
    writer.write(`: Array<${capitalize(value.ofType.name)}>;`)
    writer.newLine()
  } else if (value.kind === 'OBJECT') {
    writer.write(`: ${capitalize(value.name)};`)
    writer.newLine()
    // TODO are there other kinds that needs to be handled?
    /* c8 ignore next 3 */
  } else {
    throw new UnknownTypeError(value.kind)
  }
  writer.newLine()
}
