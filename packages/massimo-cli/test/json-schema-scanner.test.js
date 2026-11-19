import { readFile } from 'fs/promises'
import { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'path'
import { scanJSONSchema } from '../lib/json-schema/core/index.js'

const fixturesDir = join(import.meta.dirname, 'fixtures', 'json-schema')

test('scan registers root and nested property names', async () => {
  const schema = await readFixtureSchema({ example: 'some-nesting' })
  const state = scanJSONSchema({ schema })

  equal(state.rootName, 'CreateReservation')
  equal(state.nameRegistry.getPathName({ path: '#' }), 'CreateReservation')
  equal(state.nameRegistry.getPathName({ path: '#/properties/data' }), 'Data')
  equal(state.nameRegistry.getPathName({ path: '#/properties/data/properties/requestContext' }), 'DataRequestContext')
  equal(state.nameRegistry.getPathName({ path: '#/properties/data/properties/requestContext/properties/actor' }), 'DataRequestContextActor')
})

test('scan collects refs and names referenced definitions', async () => {
  const schema = await readFixtureSchema({ example: 'flat' })
  const state = scanJSONSchema({ schema })

  deepEqual([...state.references].sort(), [
    '#/definitions/CommandData',
    '#/definitions/CommandType'
  ])

  equal(state.nameRegistry.getPathName({ path: '#/definitions/CommandData' }), 'CommandData')
  equal(state.nameRegistry.getPathName({ path: '#/definitions/CommandType' }), 'CommandType')
})

test('scan keeps generated names unique', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'User',
      type: 'object',
      definitions: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  })

  equal(state.nameRegistry.getPathName({ path: '#' }), 'User')
  equal(state.nameRegistry.getPathName({ path: '#/definitions/User' }), 'User_1')
})

test('scan derives singular array item names and discriminated union branch names', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Programme',
      type: 'object',
      properties: {
        offers: {
          type: 'array',
          items: {
            type: 'object',
            oneOf: [
              {
                type: 'object',
                properties: {
                  type: { const: 'TENDER' }
                }
              }
            ]
          }
        }
      },
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { const: 'LOYALTY' }
          }
        }
      ]
    }
  })

  equal(state.nameRegistry.getPathName({ path: '#/properties/offers/items' }), 'Offer')
  equal(state.nameRegistry.getPathName({ path: '#/properties/offers/items/oneOf/0' }), 'TenderOffer')
  equal(state.nameRegistry.getPathName({ path: '#/oneOf/0' }), 'LoyaltyProgramme')
})

async function readFixtureSchema ({ example }) {
  const schemaPath = join(fixturesDir, example, 'schema.json')
  return JSON.parse(await readFile(schemaPath, 'utf8'))
}
