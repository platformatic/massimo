#! /usr/bin/env node

import { access, mkdir, readFile, rm, writeFile } from 'fs/promises'
import graphql from 'graphql'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { join, dirname } from 'path'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { getGlobalDispatcher, interceptors, request } from 'undici'
import YAML from 'yaml'
import { processFrontendOpenAPI } from './lib/frontend-openapi-generator.js'
import { processGraphQL } from './lib/graphql-generator.js'
import { processOpenAPI } from './lib/openapi-generator.js'

function parseFile (content) {
  let parsed = false
  const toTry = [JSON.parse, YAML.parse]
  for (const fn of toTry) {
    try {
      parsed = fn(content)
    } catch (err) {
      // do nothing
    }
  }
  return parsed
}

export async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

export async function createDirectory (path, empty = false) {
  if (empty) {
    await rm(path, { force: true, recursive: true })
  }

  return mkdir(path, { recursive: true, maxRetries: 10, retryDelay: 1000 })
}

export async function detectModuleFormat (folder, explicitFormat) {
  if (explicitFormat) {
    if (explicitFormat === 'esm' || explicitFormat === 'cjs') {
      return explicitFormat
    }
    throw new Error(
      `Invalid module format: ${explicitFormat}. Valid values are 'esm' or 'cjs'`
    )
  }
  let currentDir = folder
  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, 'package.json')
    if (await isFileAccessible(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
        if (packageJson.type === 'module') return 'esm'
        return 'cjs'
      } catch (err) {
      }
    }
    currentDir = dirname(currentDir)
  }

  return 'esm'
}

export async function determineTypeExtension (folder, moduleFormat, typeExtension, explicitModuleFormat, generateImplementation = true) {
  if (typeExtension) {
    return moduleFormat === 'esm' ? 'd.mts' : 'd.cts'
  }

  if (!explicitModuleFormat && !generateImplementation) {
    return 'd.ts'
  }

  if (!explicitModuleFormat && generateImplementation) {
    return 'd.ts'
  }

  let currentDir = folder
  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, 'package.json')
    if (await isFileAccessible(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
        const parentType = packageJson.type === 'module' ? 'esm' : 'cjs'

        if (moduleFormat === parentType) {
          return 'd.ts'
        }

        return moduleFormat === 'esm' ? 'd.mts' : 'd.cts'
      } catch (err) {
      }
    }
    currentDir = dirname(currentDir)
  }

  if (explicitModuleFormat) {
    return moduleFormat === 'esm' ? 'd.mts' : 'd.cts'
  }

  return 'd.ts'
}

async function writeOpenAPIClient (
  folder,
  name,
  text,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  typesComment,
  logger,
  withCredentials,
  propsOptional,
  moduleFormat,
  typeExtension,
  explicitModuleFormat
) {
  await createDirectory(folder)

  // TODO deal with yaml
  const schema = parseFile(text)
  if (!schema) {
    throw new Error(
      'Cannot parse OpenAPI file. Please make sure is a JSON or a YAML file.'
    )
  }
  if (!typesOnly) {
    await writeFile(
      join(folder, `${name}.openapi.json`),
      JSON.stringify(schema, null, 2)
    )
  }

  if (isFrontend) {
    const typeExt = await determineTypeExtension(folder, moduleFormat, typeExtension, explicitModuleFormat, generateImplementation)
    const { types, implementation } = processFrontendOpenAPI({
      schema,
      name,
      fullRequest,
      fullResponse,
      language,
      logger,
      withCredentials,
      propsOptional,
      typeExt
    })
    await writeFile(join(folder, `${name}-types.${typeExt}`), types)
    if (generateImplementation) {
      const extension = language === 'js' ? 'mjs' : 'mts'
      await writeFile(join(folder, `${name}.${extension}`), implementation)
    }
  } else {
    const { types, implementation } = processOpenAPI({
      schema,
      name,
      fullResponse,
      fullRequest,
      optionalHeaders,
      validateResponse,
      typesComment,
      propsOptional,
      moduleFormat,
    })
    const typeExt = await determineTypeExtension(folder, moduleFormat, typeExtension, explicitModuleFormat, generateImplementation)
    const implExt = moduleFormat === 'esm' ? 'mjs' : 'cjs'
    await writeFile(join(folder, `${name}.${typeExt}`), types)
    if (generateImplementation) {
      await writeFile(join(folder, `${name}.${implExt}`), implementation)
    }

    if (!typesOnly) {
      await writeFile(
        join(folder, 'package.json'),
        await getPackageJSON({ name, generateImplementation, moduleFormat, folder, typeExtension, explicitModuleFormat })
      )
    }
  }
}

async function writeGraphQLClient (
  folder,
  name,
  schema,
  url,
  generateImplementation,
  moduleFormat,
  typeExtension,
  explicitModuleFormat
) {
  await createDirectory(folder, { recursive: true })
  const { types, implementation } = processGraphQL({
    schema,
    name,
    folder,
    url,
    moduleFormat,
  })
  const clientSchema = graphql.buildClientSchema(schema)
  const sdl = graphql.printSchema(clientSchema)
  const typeExt = await determineTypeExtension(folder, moduleFormat, typeExtension, explicitModuleFormat, generateImplementation)
  const implExt = moduleFormat === 'esm' ? 'mjs' : 'cjs'
  await writeFile(join(folder, `${name}.schema.graphql`), sdl)
  await writeFile(join(folder, `${name}.${typeExt}`), types)
  if (generateImplementation) {
    await writeFile(join(folder, `${name}.${implExt}`), implementation)
  }
  await writeFile(
    join(folder, 'package.json'),
    await getPackageJSON({ name, generateImplementation, moduleFormat, folder, typeExtension, explicitModuleFormat })
  )
}

async function downloadAndWriteOpenAPI (
  logger,
  url,
  folder,
  name,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  urlAuthHeaders,
  typesComment,
  withCredentials,
  propsOptional,
  retryTimeoutMs,
  moduleFormat,
  typeExtension,
  explicitModuleFormat
) {
  logger.debug(`Trying to download OpenAPI schema from ${url}`)
  let requestOptions
  if (urlAuthHeaders) {
    try {
      requestOptions = { headers: JSON.parse(urlAuthHeaders) }
    } catch (err) {
      logger.error(err)
    }
  }

  const dispatcher = retryTimeoutMs
    ? getGlobalDispatcher().compose([
      interceptors.retry({ minTimeout: retryTimeoutMs })
    ])
    : undefined
  const res = await request(url, { ...requestOptions, dispatcher })
  if (res.statusCode === 200) {
    // we are OpenAPI
    const text = await res.body.text()
    try {
      await writeOpenAPIClient(
        folder,
        name,
        text,
        generateImplementation,
        typesOnly,
        fullRequest,
        fullResponse,
        optionalHeaders,
        validateResponse,
        isFrontend,
        language,
        typesComment,
        logger,
        withCredentials,
        propsOptional,
        moduleFormat,
        typeExtension,
        explicitModuleFormat
      )
      /* c8 ignore next 3 */
    } catch (err) {
      logger.error(err)
      return false
    }
    return 'openapi'
  }
  res.body.resume()

  return false
}

async function downloadAndWriteGraphQL (
  logger,
  url,
  folder,
  name,
  generateImplementation,
  moduleFormat,
  typeExtension,
  explicitModuleFormat
) {
  logger.debug(`Trying to download GraphQL schema from ${url}`)
  const query = graphql.getIntrospectionQuery()
  const res = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query
    }),
  })

  const text = await res.body.text()

  if (res.statusCode !== 200) {
    return false
  }

  const { data: schema } = JSON.parse(text)
  await writeGraphQLClient(
    folder,
    name,
    schema,
    url,
    generateImplementation,
    moduleFormat,
    typeExtension,
    explicitModuleFormat
  )
  return 'graphql'
}

async function readFromFileAndWrite (
  logger,
  file,
  folder,
  name,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  typesComment,
  withCredentials,
  propsOptional,
  moduleFormat,
  typeExtension,
  explicitModuleFormat
) {
  logger.info(`Trying to read schema from file ${file}`)
  const text = await readFile(file, 'utf8')
  // try OpenAPI first
  try {
    await writeOpenAPIClient(
      folder,
      name,
      text,
      generateImplementation,
      typesOnly,
      fullRequest,
      fullResponse,
      optionalHeaders,
      validateResponse,
      isFrontend,
      language,
      typesComment,
      logger,
      withCredentials,
      propsOptional,
      moduleFormat,
      typeExtension,
      explicitModuleFormat
    )
    return 'openapi'
  } catch (err) {
    logger.error(
      err,
      `Error parsing OpenAPI definition: "${err.message}". Trying with GraphQL`
    )
    // try GraphQL
    const schema = graphql.buildSchema(text)
    const introspectionResult = graphql.introspectionFromSchema(schema)

    // dummy URL
    await writeGraphQLClient(
      folder,
      name,
      introspectionResult,
      'http://localhost:3042/graphql',
      generateImplementation,
      moduleFormat,
      typeExtension,
      explicitModuleFormat
    )
    return 'graphql'
  }
}
async function downloadAndProcess (options) {
  const {
    url,
    name,
    folder,
    logger,
    typesOnly,
    fullRequest,
    fullResponse,
    optionalHeaders,
    validateResponse,
    isFrontend,
    language,
    type,
    urlAuthHeaders,
    typesComment,
    withCredentials,
    propsOptional,
    retryTimeoutMs,
    moduleFormat,
    typeExtension,
    explicitModuleFormat
  } = options

  const generateImplementation = options.generateImplementation

  let found = false
  const toTry = []
  if (url.startsWith('http')) {
    if (type === 'openapi') {
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url + '/documentation/json',
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
    } else if (options.type === 'graphql') {
      toTry.push(
        downloadAndWriteGraphQL.bind(
          null,
          logger,
          url + '/graphql',
          folder,
          name,
          generateImplementation,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
      toTry.push(
        downloadAndWriteGraphQL.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
    } else {
      // add download functions only if it's an URL
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url + '/documentation/json',
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
      toTry.push(
        downloadAndWriteGraphQL.bind(
          null,
          logger,
          url + '/graphql',
          folder,
          name,
          generateImplementation,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
      toTry.push(
        downloadAndWriteGraphQL.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          moduleFormat,
          typeExtension,
          explicitModuleFormat
        )
      )
    }
  } else {
    // add readFromFileAndWrite to the functions only if it's not an URL
    toTry.push(
      readFromFileAndWrite.bind(
        null,
        logger,
        url,
        folder,
        name,
        generateImplementation,
        typesOnly,
        fullRequest,
        fullResponse,
        optionalHeaders,
        validateResponse,
        isFrontend,
        language,
        typesComment,
        withCredentials,
        propsOptional,
        moduleFormat,
        typeExtension,
        explicitModuleFormat
      )
    )
  }
  for (const fn of toTry) {
    found = await fn()
    if (found) {
      break
    }
  }
  /* c8 ignore next 3 */
  if (!found) {
    throw new Error(
      `Could not find a valid OpenAPI or GraphQL schema at ${url}`
    )
  }
}

async function getPackageJSON ({ name, generateImplementation, moduleFormat, folder, typeExtension, explicitModuleFormat }) {
  const isESM = moduleFormat === 'esm'
  const typeExt = await determineTypeExtension(folder, moduleFormat, typeExtension, explicitModuleFormat, generateImplementation)
  const obj = {
    name,
    types: `./${name}.${typeExt}`
  }

  if (isESM) {
    obj.type = 'module'
  }

  if (generateImplementation) {
    obj.main = `./${name}.${isESM ? 'mjs' : 'cjs'}`
  }

  return JSON.stringify(obj, null, 2)
}

export async function command (argv) {
  const help = helpMe({
    dir: join(import.meta.dirname, 'help'),
    // the default
    ext: '.txt'
  })
  const {
    _: [url],
    ...options
  } = parseArgs(argv, {
    string: [
      'name',
      'folder',
      'optional-headers',
      'language',
      'type',
      'url-auth-headers',
      'types-comment',
      'module'
    ],
    boolean: [
      'typescript',
      'full-response',
      'types-only',
      'full-request',
      'full',
      'frontend',
      'validate-response',
      'props-optional',
      'type-extension'
    ],
    default: {
      typescript: false,
      language: 'js',
      full: true,
      'props-optional': true
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript',
      c: 'config',
      F: 'full',
      h: 'help'
    }
  })

  if (options.full || options.F) {
    // force both fullRequest and fullResponse
    options['full-request'] = true
    options['full-response'] = true
  }
  const stream = pinoPretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
    minimumLevel: 'debug',
    sync: true
  })

  const logger = pino(stream)

  if (!url || options.help) {
    await help.toStdout()
    process.exit(1)
  }

  try {
    options.isFrontend = !!options.frontend
    if (options['types-only']) {
      options.generateImplementation = false
      options.typesOnly = true
    } else {
      options.generateImplementation = options.isFrontend ? true : !options.config
    }

    options.fullRequest = options['full-request']
    options.fullResponse = options['full-response']
    options.propsOptional = options['props-optional']

    options.optionalHeaders = options['optional-headers']
      ? options['optional-headers'].split(',').map((h) => h.trim())
      : []

    options.validateResponse = options['validate-response']

    if (!options.name) {
      options.name = options.isFrontend ? 'api' : 'client'
    }
    options.folder = options.folder || join(process.cwd(), options.name)
    options.moduleFormat = await detectModuleFormat(options.folder, options.module)
    if (!options.module) {
      logger.info(`Module format detected: ${options.moduleFormat}`)
    }
    options.urlAuthHeaders = options['url-auth-headers']
    options.typesComment = options['types-comment']
    options.withCredentials = options['with-credentials']
    options.retryTimeoutMs = options['retry-timeout-ms']
    options.typeExtension = options['type-extension']
    options.explicitModuleFormat = !!options.module
    await downloadAndProcess({ url, ...options, logger })
    logger.info(`Client generated successfully into ${options.folder}`)
    logger.info('Check out the docs to know more: https://docs.platformatic.dev/docs/service/overview')
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}

if (import.meta.main) {
  command(process.argv.slice(2))
}

export * as errors from './lib/errors.js'
