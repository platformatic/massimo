import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { deepEqual, equal, ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'node:path'
import { moveToTmpdir } from './helper.js'

const cli = join(import.meta.dirname, '..', 'index.js')
const openAPIfile = join(import.meta.dirname, 'fixtures', 'path-map-openapi.json')
const env = { ...process.env, NODE_V8_COVERAGE: undefined }

function findTSCPath () {
  const tscPath = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsc')
  return existsSync(tscPath) ? tscPath : join(import.meta.dirname, '../../..', 'node_modules', '.bin', 'tsc')
}

// The fixture covers an operation without operationId (`GET /movies/{id}`), an
// operationId used twice (`createFolder`), and an operation whose only
// response is a 204 (`deleteMovie`).
const expectedPathMap = `export interface MoviesPaths {
  '/movies': {
    'get': { 'request': GetMoviesRequest; 'responses': GetMoviesResponses };
    'post': { 'request': CreateMovieRequest; 'responses': CreateMovieResponses };
  }
  '/movies/{id}': {
    'get': { 'request': GetMoviesIdRequest; 'responses': GetMoviesIdResponses };
    'delete': { 'request': DeleteMovieRequest; 'responses': DeleteMovieResponses };
  }
  '/accounts/{accountId}/folders': {
    'post': { 'request': CreateFolderRequest; 'responses': CreateFolderResponses };
  }
  '/folders': {
    'post': { 'request': PostCreateFolderRequest; 'responses': PostCreateFolderResponses };
  }
}`

const expectedAliases = `export type MoviesPathRequest<P extends keyof MoviesPaths, M extends keyof MoviesPaths[P]> = MoviesPaths[P][M] extends { 'request': infer R } ? R : never
export type MoviesPathResponses<P extends keyof MoviesPaths, M extends keyof MoviesPaths[P]> = MoviesPaths[P][M] extends { 'responses': infer R } ? R : never`

// Type-level assertions on the generated declarations: each entry of the map
// is exactly the request and responses types of the client method, the lookup
// aliases resolve every entry for a generic path and method, and a path or a
// method that is not in the spec does not compile.
const typeCheck = (from) => `
import type * as T from '${from}'

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
type Method<K extends keyof T.Movies> = T.Movies[K] extends (req: infer Req) => Promise<infer Res> ? { request: Req; responses: Res } : never

export const checks: true[] = [
  {} as Equal<T.MoviesPaths['/movies']['get'], Method<'getMovies'>>,
  {} as Equal<T.MoviesPaths['/movies']['post'], Method<'createMovie'>>,
  {} as Equal<T.MoviesPaths['/movies/{id}']['get'], Method<'getMoviesId'>>,
  {} as Equal<T.MoviesPaths['/movies/{id}']['delete'], Method<'deleteMovie'>>,
  {} as Equal<T.MoviesPaths['/accounts/{accountId}/folders']['post'], Method<'createFolder'>>,
  {} as Equal<T.MoviesPaths['/folders']['post'], Method<'postCreateFolder'>>,
  {} as Equal<T.MoviesPathRequest<'/movies/{id}', 'get'>, T.GetMoviesIdRequest>,
  {} as Equal<T.MoviesPathRequest<'/folders', 'post'>, T.PostCreateFolderRequest>,
  {} as Equal<T.MoviesPathResponses<'/folders', 'post'>, T.PostCreateFolderResponses>,
  {} as Equal<T.MoviesPathResponses<'/movies/{id}', 'delete'>, T.DeleteMovieResponses>
]

// Every entry, looked up through the aliases, is the entry itself and not never
type IsNever<X> = [X] extends [never] ? true : false
type Resolved<P extends keyof T.MoviesPaths, M extends keyof T.MoviesPaths[P]> =
  IsNever<T.MoviesPathRequest<P, M>> extends true ? false
    : IsNever<T.MoviesPathResponses<P, M>> extends true ? false
      : Equal<T.MoviesPaths[P][M], { 'request': T.MoviesPathRequest<P, M>; 'responses': T.MoviesPathResponses<P, M> }>
type AllResolved = { [P in keyof T.MoviesPaths]: { [M in keyof T.MoviesPaths[P]]: Resolved<P, M> }[keyof T.MoviesPaths[P]] }[keyof T.MoviesPaths]
export const allResolved: Equal<AllResolved, true> = true

// A caller generic over path and method
export declare function call<P extends keyof T.MoviesPaths, M extends keyof T.MoviesPaths[P]> (path: P, method: M, req: T.MoviesPathRequest<P, M>): Promise<T.MoviesPathResponses<P, M>>
export const created = call('/folders', 'post', { body: { name: 'a', accountId: 1 } })

// @ts-expect-error a path that is not in the spec
export type MissingPath = T.MoviesPaths['/series']
// @ts-expect-error a method that the path does not have
export type MissingMethod = T.MoviesPaths['/folders']['get']
// @ts-expect-error a path that is not in the spec, through the alias
export type MissingAliasPath = T.MoviesPathRequest<'/series', 'get'>
// @ts-expect-error a method that the path does not have, through the alias
export type MissingAliasMethod = T.MoviesPathResponses<'/folders', 'get'>
`

async function typecheck (dir, source, lib) {
  await writeFile(join(dir, 'check.ts'), source)
  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      module: 'nodenext',
      moduleResolution: 'nodenext',
      lib,
      strict: true,
      noEmit: true,
      // the declaration file itself is checked, not only its use from check.ts
      skipLibCheck: false,
      types: []
    },
    files: ['check.ts']
  }, null, 2))
  await execa(findTSCPath(), ['-p', join(dir, 'tsconfig.json')], { env })
}

const generators = [
  { label: 'node', args: ['--types-only'], file: 'movies.d.ts', from: './movies/movies.js', lib: ['es2022'] },
  { label: '--frontend', args: ['--frontend', '--language', 'ts'], file: 'movies-types.d.ts', from: './movies/movies-types.js', lib: ['es2022', 'dom'] }
]

for (const { label, args, file, from, lib } of generators) {
  test(`--path-map declares a path map of the client method types (${label})`, async () => {
    const dir = await moveToTmpdir(after)
    await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
    await execa('node', [cli, openAPIfile, '--name', 'movies', ...args, '--path-map'])
    const data = await readFile(join(dir, 'movies', file), 'utf-8')

    ok(data.includes(expectedPathMap))
    ok(data.includes(expectedAliases))
    equal(data.match(/export interface MoviesPaths\b/g).length, 1)
    // the operation without operationId is named from its path
    ok(data.includes('getMoviesId(req: GetMoviesIdRequest): Promise<GetMoviesIdResponses>;'))
    // the second `createFolder` is renamed, and the map follows the rename
    ok(data.includes('createFolder(req: CreateFolderRequest): Promise<CreateFolderResponses>;'))
    ok(data.includes('postCreateFolder(req: PostCreateFolderRequest): Promise<PostCreateFolderResponses>;'))
    // the 204-only operation keeps its responses type
    ok(data.includes('export type DeleteMovieResponses =\n  FullResponse<undefined, 204>'))
    // without --named-schemas the component schemas stay inlined, so no
    // schema takes or is moved off the names of the map
    equal(data.includes('MoviesPathsSchema'), false)
    equal(data.includes('MoviesPathRequestSchema'), false)

    await typecheck(dir, typeCheck(from), lib)
  })

  test(`--path-map with --named-schemas renames a schema named like the map (${label})`, async () => {
    const dir = await moveToTmpdir(after)
    await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
    await execa('node', [cli, openAPIfile, '--name', 'movies', ...args, '--named-schemas', '--path-map'])
    const data = await readFile(join(dir, 'movies', file), 'utf-8')

    ok(data.includes(expectedPathMap))
    ok(data.includes(expectedAliases))
    // the component schemas `MoviesPaths` and `MoviesPathRequest` give way
    ok(data.includes("// components.schemas['MoviesPaths'] is declared as MoviesPathsSchema: its own name is taken\nexport type MoviesPathsSchema = string"))
    ok(data.includes("// components.schemas['MoviesPathRequest'] is declared as MoviesPathRequestSchema: its own name is taken\nexport type MoviesPathRequestSchema = number"))
    equal(data.match(/export interface MoviesPaths\b/g).length, 1)
    equal(data.match(/export type MoviesPathRequest\b/g).length, 1)

    await typecheck(dir, typeCheck(from), lib)
  })
}

for (const extra of [[], ['--named-schemas']]) {
  test(`--path-map suffixes a lookup alias whose name an operation type already has (${['--path-map', ...extra].join(' ')})`, async () => {
    const dir = await moveToTmpdir(after)
    await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
    const file = join(dir, 'alias-collision.json')
    await writeFile(file, JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Alias collision', version: '1.0.0' },
      paths: { '/movies-path': { get: { operationId: 'moviesPath', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { type: 'string' } } } } } } } }
    }))
    await execa('node', [cli, file, '--name', 'movies', '--types-only', '--path-map', ...extra])
    const data = await readFile(join(dir, 'movies', 'movies.d.ts'), 'utf-8')

    ok(data.includes('moviesPath(req: MoviesPathRequest): Promise<MoviesPathResponses>;'))
    ok(data.includes('export type MoviesPathRequest2<'))
    ok(data.includes('export type MoviesPathResponses2<'))

    await typecheck(dir, `
import type * as T from './movies/movies.js'
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
export const checks: true[] = [
  {} as Equal<T.MoviesPathRequest2<'/movies-path', 'get'>, T.MoviesPathRequest>,
  {} as Equal<T.MoviesPathResponses2<'/movies-path', 'get'>, T.MoviesPathResponses>
]
`, ['es2022'])
  })
}

test('--path-map on a spec without components.schemas does not warn', async () => {
  const dir = await moveToTmpdir(after)
  const file = join(dir, 'no-schemas.json')
  await writeFile(file, JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'No schemas', version: '1.0.0' },
    paths: { '/hello': { get: { operationId: 'getHello', responses: { 200: { description: 'ok' } } } } }
  }))
  const { stdout } = await execa('node', [cli, file, '--name', 'movies', '--types-only', '--path-map'])
  const data = await readFile(join(dir, 'movies', 'movies.d.ts'), 'utf-8')

  ok(data.includes("'/hello': {\n    'get': { 'request': GetHelloRequest; 'responses': GetHelloResponses };"))
  equal(stdout.includes('has no effect'), false)
})

// Everything the CLI writes without --path-map, every file of every mode, is
// what it writes with --path-map once the map and its aliases are removed and,
// with --named-schemas, the renames of the schemas named like the map are undone.
const modes = [['--types-only'], [], ['--frontend'], ['--frontend', '--language', 'ts']]
const declaresMap = /export (interface MoviesPaths\b|type MoviesPath(Request|Responses)<)/
const mapBlock = /export interface MoviesPaths \{\n[\s\S]*?\n\}\n\nexport type MoviesPathRequest<[^\n]*\nexport type MoviesPathResponses<[^\n]*\n/

for (const mode of modes) {
  for (const extra of [[], ['--named-schemas']]) {
    const flags = [...mode, ...extra].join(' ') || 'full client'
    const undone = extra.length === 0 ? '' : ' and the schema renames undone'
    test(`without --path-map the output is the same as with it, map and aliases removed${undone} (${flags})`, async () => {
      const dir = await moveToTmpdir(after)
      await execa('node', [cli, openAPIfile, '--name', 'movies', '--folder', join(dir, 'without'), ...mode, ...extra])
      await execa('node', [cli, openAPIfile, '--name', 'movies', '--folder', join(dir, 'with'), ...mode, ...extra, '--path-map'])

      const files = (await readdir(join(dir, 'without'))).sort()
      deepEqual((await readdir(join(dir, 'with'))).sort(), files)
      let maps = 0
      for (const name of files) {
        const without = await readFile(join(dir, 'without', name), 'utf-8')
        const withMap = await readFile(join(dir, 'with', name), 'utf-8')
        equal(declaresMap.test(without), false)
        if (withMap !== without) {
          maps++
          if (extra.length === 0) {
            equal(withMap.replace(mapBlock, ''), without)
          } else {
            // with named schemas, the schemas named like the map are renamed too
            equal(withMap.replace(mapBlock, '')
              .replace(/\/\/ components\.schemas\['(MoviesPaths|MoviesPathRequest)'\] is declared as [^\n]*\n/g, '')
              .replace('export type MoviesPathsSchema = string', 'export type MoviesPaths = string')
              .replace('export type MoviesPathRequestSchema = number', 'export type MoviesPathRequest = number'), without)
          }
        }
      }
      equal(maps, 1)
    })
  }
}
