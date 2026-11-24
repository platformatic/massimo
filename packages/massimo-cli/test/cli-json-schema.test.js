import { execa } from 'execa'
import { promises as fs } from 'fs'
import { equal, match, ok, rejects } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { moveToTmpdir } from './helper.js'

test('json schema type generation from local file', async () => {
  const dir = await moveToTmpdir(after)
  const schemaPath = join(dir, 'schema.json')

  await fs.writeFile(schemaPath, JSON.stringify({
    title: 'Claim',
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string'
      }
    }
  }, null, 2))

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    schemaPath,
    '--type',
    'json-schema',
    '--name',
    'claim-types',
    '--types-only'
  ])

  const output = await fs.readFile(join(dir, 'claim-types', 'claim-types.d.ts'), 'utf8')
  match(output, /interface ClaimTypes \{/)
  match(output, /id: Id;/)
  ok(!output.includes('package.json'))
})

test('json schema CLI rejects remote urls', async () => {
  await rejects(
    execa('node', [
      join(import.meta.dirname, '..', 'index.js'),
      'https://example.com/schema.json',
      '--type',
      'json-schema',
      '--name',
      'claim-types',
      '--types-only'
    ]),
    error => {
      equal(error.exitCode, 1)
      match(error.message, /JSON Schema generation currently supports local files only\./)
      return true
    }
  )
})

test('json schema CLI rejects implementation generation', async () => {
  const dir = await moveToTmpdir(after)
  const schemaPath = join(dir, 'schema.json')

  await fs.writeFile(schemaPath, JSON.stringify({
    title: 'Claim',
    type: 'object',
    properties: {}
  }, null, 2))

  await rejects(
    execa('node', [
      join(import.meta.dirname, '..', 'index.js'),
      schemaPath,
      '--type',
      'json-schema',
      '--name',
      'claim-types'
    ]),
    error => {
      equal(error.exitCode, 1)
      match(error.message, /JSON Schema generation only supports type output\./)
      return true
    }
  )
})
