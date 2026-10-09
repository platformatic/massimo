import { execa } from 'execa'
import { readFile } from 'fs/promises'
import { deepEqual, equal, ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { buildSchemaNames } from '../lib/schema-names.js'
import { moveToTmpdir } from './helper.js'

const openAPIfile = join(import.meta.dirname, 'fixtures', 'named-schemas-openapi.json')
const collisionsFile = join(import.meta.dirname, 'fixtures', 'named-schemas-collisions-openapi.json')

async function generate (args, file = openAPIfile) {
  const dir = await moveToTmpdir(after)
  await execa('node', [join(import.meta.dirname, '..', 'index.js'), file, '--name', 'movies', '--types-only', ...args])
  return readFile(join(dir, 'movies', 'movies.d.ts'), 'utf-8')
}

test('--named-schemas declares every component and prints $ref as its name', async () => {
  const data = await generate(['--named-schemas'])

  ok(data.includes("export interface Movie { 'id': number; 'title': string; 'releasedAt'?: string | null }"))
  // recursion goes through the name instead of collapsing to unknown
  ok(data.includes("export interface Quote { 'id': number; 'movie': Movie; 'replies'?: Array<Quote> }"))
  // allOf of a named object plus one inline object extends the named interface
  ok(data.includes("export interface FeaturedQuote extends Quote { 'rank': number }"))
  ok(data.includes('export type MovieOrQuote = Movie | Quote'))
  // component keys that are not identifiers are converted to PascalCase
  ok(data.includes('export type RatingValue = number | null'))
  ok(data.includes('export type GetMoviesResponseOK = Array<Movie>'))
  ok(data.includes('export type GetQuoteResponseOK = FeaturedQuote'))
  // request positions keep inlining, so dates still accept `Date`
  ok(data.includes("'releasedAt'?: string | Date | null;"))
  ok(data.includes("'sequel'?: { 'title': string; 'releasedAt'?: string | Date | null; 'sequel'?: unknown };"))
})

test('without --named-schemas the output inlines components as before', async () => {
  const data = await generate([])

  equal(data.includes('export interface Movie '), false)
  ok(data.includes("export type GetMoviesResponseOK = Array<{ 'id': number; 'title': string; 'releasedAt'?: string | null }>"))
  ok(data.includes("'replies'?: Array<unknown>"))
})

test('--named-schemas renames a schema whose name a generated type already takes', async () => {
  const data = await generate(['--named-schemas'], collisionsFile)

  // operation types keep their names, the colliding schema gets a suffix
  ok(data.includes('export type GetMovieResponseOK = GetMovieResponseOKSchema2'))
  ok(data.includes("export interface GetMovieResponseOKSchema2 { 'id': number }"))
  ok(data.includes("// components.schemas['GetMovieResponseOK'] is declared as GetMovieResponseOKSchema2: its own name is taken"))
  // a schema whose own name is free keeps it, even when it equals a rename candidate
  ok(data.includes("export interface GetMovieResponseOKSchema { 'note': string }"))
  // the client type and global types referenced by the output are taken too
  ok(data.includes('export type MoviesSchema = Array<ArraySchema>'))
  ok(data.includes("export interface ArraySchema { 'title': string }"))
  ok(data.includes('export type ListMoviesResponseOK = MoviesSchema'))
  ok(data.includes('export type Movies = {'))
  // two keys that convert to the same identifier: the verbatim one wins
  ok(data.includes('export type FooBar = string'))
  ok(data.includes('export type FooBarSchema = number'))
  equal(data.includes('export interface GetMovieResponseOK '), false)
})

test('buildSchemaNames is deterministic and maps refs with JSON pointer escaping', () => {
  const spec = {
    components: {
      schemas: {
        'a/b': { type: 'string' },
        AB: { type: 'string' },
        string: { type: 'string' },
        Taken: { type: 'string' },
        TakenSchema: { type: 'string' }
      }
    }
  }
  const names = buildSchemaNames(spec, ['Taken'])
  deepEqual([...names.entries()], [
    ['#/components/schemas/AB', 'AB'],
    ['#/components/schemas/TakenSchema', 'TakenSchema'],
    ['#/components/schemas/a~1b', 'ABSchema'],
    ['#/components/schemas/string', 'stringSchema'],
    ['#/components/schemas/Taken', 'TakenSchema2']
  ])
  deepEqual([...buildSchemaNames(spec, ['Taken']).entries()], [...names.entries()])
  equal(buildSchemaNames({}).size, 0)
})

test('--named-schemas works with --frontend', async () => {
  const dir = await moveToTmpdir(after)
  await execa('node', [join(import.meta.dirname, '..', 'index.js'), openAPIfile, '--name', 'movies', '--frontend', '--language', 'ts', '--named-schemas'])
  const data = await readFile(join(dir, 'movies', 'movies-types.d.ts'), 'utf-8')

  ok(data.includes("export interface Quote { 'id': number; 'movie': Movie; 'replies'?: Array<Quote> }"))
  ok(data.includes('export type GetMoviesResponseOK = Array<Movie>'))
})
