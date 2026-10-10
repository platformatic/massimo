import { execa } from 'execa'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { deepEqual, equal, ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { buildSchemaNames, toTypeName } from '../lib/schema-names.js'
import { moveToTmpdir } from './helper.js'

const openAPIfile = join(import.meta.dirname, 'fixtures', 'named-schemas-openapi.json')
const collisionsFile = join(import.meta.dirname, 'fixtures', 'named-schemas-collisions-openapi.json')
const edgeFile = join(import.meta.dirname, 'fixtures', 'named-schemas-edge-openapi.json')

function findTSCPath () {
  const tscPath = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsc')
  return existsSync(tscPath) ? tscPath : join(import.meta.dirname, '../../..', 'node_modules', '.bin', 'tsc')
}

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

test('--named-schemas extends a parent only when the members agree on every shared property', async () => {
  const data = await generate(['--named-schemas'], edgeFile)

  // an inline property that restates a parent property with another type or optionality
  ok(data.includes("export type Restated = Base & { 'kind': 'a' | 'b' }"))
  ok(data.includes("export type OptionalId = Base & { 'id'?: number; 'note'?: string }"))
  // two parents that declare the same property differently
  ok(data.includes('export type TwoParents = Base & Other'))
  // members that declare disjoint properties extend, recursion included
  ok(data.includes("export interface SafeChild extends Base, Labeled { 'rank': number; 'children'?: Array<SafeChild> }"))
  ok(data.includes("export interface Bird extends Winged { 'kind': string }"))
  equal(data.includes('interface Restated'), false)
  equal(data.includes('interface OptionalId'), false)
  equal(data.includes('interface TwoParents'), false)
})

test('--named-schemas narrows a discriminated oneOf by its mapping and keeps enum members as they are', async () => {
  const data = await generate(['--named-schemas'], edgeFile)

  // enum members already carry their value; a plain string member takes its mapping key
  ok(data.includes("export type Pet = Dog | Cat | (Lizard & { 'petType': 'lizard' })"))
  // without a mapping the component name is the value, optionality follows the member
  ok(data.includes("export type Animal = (Fish & { 'kind'?: 'Fish' }) | (Bird & { 'kind': 'Bird' })"))
  // a child that restates its parent's plain string as an enum keeps the enum
  ok(data.includes("export type Shape = Restated | (Square & { 'kind': 'Square' })"))
})

test('--named-schemas escapes the end of a comment in a description and keeps non-ASCII names', async () => {
  const data = await generate(['--named-schemas'], edgeFile)

  ok(data.includes(' * Accepts *\\/* and ends the comment early\n * unless it is escaped\n */'))
  ok(data.includes("// components.schemas['line\\nbreak'] is declared as LineBreakSchema: its own name is taken\nexport type LineBreakSchema = boolean"))
  ok(data.includes('export type Größe = number'))
  ok(data.includes('export type GrößeWert = string'))
})

test('--named-schemas output for the edge cases compiles and keeps the discriminated union usable', async () => {
  const dir = await moveToTmpdir(after)
  await execa('node', [join(import.meta.dirname, '..', 'index.js'), edgeFile, '--name', 'movies', '--types-only', '--named-schemas'])
  await writeFile(join(dir, 'check.ts'), `
import type { GetAnimalsResponseOK, GetPetsResponseOK, Größe, GrößeWert, Media, OptionalId, Restated, SafeChild, Shape, TwoParents } from './movies/movies.js'

export const dog: GetPetsResponseOK = { petType: 'dog', bark: 'woof' }
export const cat: GetPetsResponseOK = { petType: 'cat', meow: 'meow' }
export const lizard: GetPetsResponseOK = { petType: 'lizard', scales: 3 }
// @ts-expect-error the value is the mapping key, not the component name
export const wrongLizard: GetPetsResponseOK = { petType: 'Lizard' }
export const fish: GetAnimalsResponseOK = { kind: 'Fish', fins: 2 }
export const bird: GetAnimalsResponseOK = { kind: 'Bird', wings: 2 }
export const shape: Shape = { id: 1, kind: 'a' }
export const square: Shape = { kind: 'Square', side: 2 }
export const restated: Restated = { id: 1, kind: 'a' }
export const optionalId: OptionalId = { id: 1, kind: 'k' }
export const safeChild: SafeChild = { id: 1, kind: 'k', label: 'l', rank: 1, children: [{ id: 2, kind: 'k', rank: 2 }] }
export type Parents = TwoParents
export const media: Media = { mime: '*/*' }
export const size: Größe = 1
export const value: GrößeWert = 'x'
`)
  // the declaration file itself is checked: an interface that cannot extend its
  // parents or a comment closed early is an error there, not at the use site
  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
    extends: 'fastify-tsconfig',
    compilerOptions: { noEmit: true, target: 'es2022', module: 'nodenext', moduleResolution: 'NodeNext', lib: ['es2022'], skipLibCheck: false, types: [] },
    files: ['check.ts', 'movies/movies.d.ts']
  }, null, 2))
  await execa(findTSCPath(), [], { cwd: dir })
})

test('toTypeName keeps letters and digits of any script', () => {
  equal(toTypeName('Größe'), 'Größe')
  equal(toTypeName('größe-wert'), 'GrößeWert')
  equal(toTypeName('名前'), '名前')
  equal(toTypeName('2nd-größe'), 'Schema2ndGröße')
  equal(toTypeName('foo_bar-baz'), 'FooBarBaz')
  equal(toTypeName('---'), 'Schema')
})

test('--named-schemas warns when the spec has no components.schemas', async () => {
  const dir = await moveToTmpdir(after)
  const file = join(dir, 'no-components.json')
  await writeFile(file, JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'No components', version: '1.0.0' },
    paths: { '/ping': { get: { operationId: 'ping', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { type: 'string' } } } } } } } }
  }))
  const { stdout } = await execa('node', [join(import.meta.dirname, '..', 'index.js'), file, '--name', 'movies', '--types-only', '--named-schemas'])
  ok(stdout.includes('--named-schemas has no effect: the spec has no components.schemas'))
  const emptyFile = join(dir, 'empty-components.json')
  await writeFile(emptyFile, JSON.stringify({ ...JSON.parse(await readFile(file, 'utf-8')), components: { schemas: {} } }))
  const { stdout: empty } = await execa('node', [join(import.meta.dirname, '..', 'index.js'), emptyFile, '--name', 'movies', '--types-only', '--named-schemas'])
  ok(empty.includes('--named-schemas has no effect: the spec has no components.schemas'))
  const { stdout: withSchemas } = await execa('node', [join(import.meta.dirname, '..', 'index.js'), openAPIfile, '--name', 'movies', '--types-only', '--named-schemas'])
  equal(withSchemas.includes('--named-schemas has no effect'), false)
})
