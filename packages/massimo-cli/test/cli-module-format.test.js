import { create } from '@platformatic/db'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { deepEqual } from 'node:assert'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { moveToTmpdir } from './helper.js'

test('module format - no package.json (defaults to ESM)', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(after)

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    app.url + '/graphql',
    '--name',
    'movies'
  ])

  const files = await fs.readdir(join(dir, 'movies'))
  deepEqual(files.sort(), [
    'movies.d.ts',
    'movies.mjs',
    'movies.schema.graphql',
    'package.json'
  ])

  // Check generated package.json
  const pkg = JSON.parse(
    await fs.readFile(join(dir, 'movies', 'package.json'), 'utf-8')
  )
  deepEqual(pkg, {
    name: 'movies',
    types: './movies.d.ts',
    type: 'module',
    main: './movies.mjs'
  })
})

test('module format - package.json without type field (defaults to CommonJS)', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(after)

  await fs.writeFile(
    './package.json',
    JSON.stringify({ name: 'my-project' })
  )

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    app.url + '/graphql',
    '--name',
    'movies'
  ])

  const files = await fs.readdir(join(dir, 'movies'))
  deepEqual(files.sort(), [
    'movies.cjs',
    'movies.d.ts',
    'movies.schema.graphql',
    'package.json'
  ])

  const pkg = JSON.parse(
    await fs.readFile(join(dir, 'movies', 'package.json'), 'utf-8')
  )
  deepEqual(pkg, {
    name: 'movies',
    types: './movies.d.ts',
    main: './movies.cjs'
  })
})

test('module format - package.json with type commonjs (generates CommonJS)', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(after)

  await fs.writeFile(
    './package.json',
    JSON.stringify({
      name: 'my-project',
      type: 'commonjs'
    })
  )

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    app.url + '/graphql',
    '--name',
    'movies'
  ])

  const files = await fs.readdir(join(dir, 'movies'))
  deepEqual(files.sort(), [
    'movies.cjs',
    'movies.d.ts',
    'movies.schema.graphql',
    'package.json'
  ])

  const pkg = JSON.parse(
    await fs.readFile(join(dir, 'movies', 'package.json'), 'utf-8')
  )
  deepEqual(pkg, {
    name: 'movies',
    types: './movies.d.ts',
    main: './movies.cjs'
  })
})

test('module format - explicit --module esm flag', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(after)

  await fs.writeFile(
    './package.json',
    JSON.stringify({
      name: 'my-project',
      type: 'commonjs'
    })
  )

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    app.url + '/graphql',
    '--name',
    'movies',
    '--module',
    'esm'
  ])

  const files = await fs.readdir(join(dir, 'movies'))
  deepEqual(files.sort(), [
    'movies.d.mts',
    'movies.mjs',
    'movies.schema.graphql',
    'package.json'
  ])

  const pkg = JSON.parse(
    await fs.readFile(join(dir, 'movies', 'package.json'), 'utf-8')
  )
  deepEqual(pkg, {
    name: 'movies',
    types: './movies.d.mts',
    type: 'module',
    main: './movies.mjs'
  })
})

test('module format - explicit --module cjs flag', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  const dir = await moveToTmpdir(after)

  await fs.writeFile(
    './package.json',
    JSON.stringify({
      name: 'my-project',
      type: 'module'
    })
  )

  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    app.url + '/graphql',
    '--name',
    'movies',
    '--module',
    'cjs'
  ])

  const files = await fs.readdir(join(dir, 'movies'))
  deepEqual(files.sort(), [
    'movies.cjs',
    'movies.d.cts',
    'movies.schema.graphql',
    'package.json'
  ])

  const pkg = JSON.parse(
    await fs.readFile(join(dir, 'movies', 'package.json'), 'utf-8')
  )
  deepEqual(pkg, {
    name: 'movies',
    types: './movies.d.cts',
    main: './movies.cjs'
  })
})

test('module format - invalid --module flag throws error', async t => {
  try {
    await fs.unlink(
      join(import.meta.dirname, 'fixtures', 'movies', 'db.sqlite')
    )
  } catch {
    // noop
  }
  const app = await create(
    join(import.meta.dirname, 'fixtures', 'movies', 'zero.db.json')
  )
  await app.start()
  after(async () => {
    await app.close()
  })

  try {
    await execa('node', [
      join(import.meta.dirname, '..', 'index.js'),
      app.url + '/graphql',
      '--name',
      'movies',
      '--module',
      'invalid'
    ])
    throw new Error('Should have thrown an error for invalid module format')
  } catch (error) {
    if (error.message.includes('Should have thrown')) {
      throw error
    }
    const output = error.stdout || error.stderr || error.message
    if (!output.includes('Invalid module format: invalid')) {
      throw new Error(
        `Expected error about invalid module format, got: ${output}`
      )
    }
  }
})
