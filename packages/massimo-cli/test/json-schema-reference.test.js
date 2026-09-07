import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { renderReferenceType, createRenderContext, createChildRenderContext } from '../lib/json-schema/render/index.js'
import { scanJSONSchema } from '../lib/json-schema/core/index.js'

test('createChildRenderContext preserves shared render state', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'User',
      type: 'object',
      properties: {
        profile: {
          type: 'object'
        }
      }
    }
  })

  const rootContext = createRenderContext({
    schema: state.rootSchema,
    state,
    lookupPathName: false
  })

  const childContext = createChildRenderContext({
    context: rootContext,
    schema: state.rootSchema.properties.profile,
    pathSuffix: 'properties/profile'
  })

  equal(childContext.rootSchema, rootContext.rootSchema)
  equal(childContext.nameRegistry, rootContext.nameRegistry)
  equal(childContext.path, '#/properties/profile')
  equal(childContext.lookupPathName, rootContext.lookupChildPathNames)
  equal(childContext.lookupChildPathNames, rootContext.lookupChildPathNames)
})

test('renderReferenceType prefers the canonical scanned name for internal refs', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Envelope',
      type: 'object',
      properties: {
        payload: {
          $ref: '#/definitions/Payload'
        }
      },
      definitions: {
        Payload: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  })

  const context = createRenderContext({
    schema: state.rootSchema.properties.payload,
    state,
    path: '#/properties/payload'
  })

  equal(renderReferenceType({
    ref: '#/definitions/Payload',
    context,
    renderType () {
      return 'should-not-inline'
    }
  }), 'Payload')
})

test('renderReferenceType falls back to inline rendering when registry has no name', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Envelope',
      definitions: {
        Flag: {
          type: 'boolean'
        }
      }
    }
  })

  const context = createRenderContext({
    schema: state.rootSchema,
    state,
    lookupPathName: false
  })

  equal(renderReferenceType({
    ref: '#/definitions/Missing',
    context,
    renderType () {
      return 'boolean'
    }
  }), 'unknown')

  equal(renderReferenceType({
    ref: '#/definitions/Flag',
    context: {
      ...context,
      nameRegistry: {
        getPathName () {
          return undefined
        }
      }
    },
    renderType ({ context: inlineContext }) {
      return inlineContext.schema.type
    }
  }), 'boolean')
})

test('renderReferenceType does not alias refs that stay within the same logical scope', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Envelope',
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              status: {
                $ref: '#/properties/items/items/definitions/Status'
              }
            },
            definitions: {
              Status: {
                type: 'string',
                enum: ['ACTIVE', 'INACTIVE']
              }
            }
          }
        }
      }
    }
  })

  const context = createRenderContext({
    schema: state.rootSchema.properties.items.items.properties.status,
    state,
    path: '#/properties/items/items/properties/status'
  })

  equal(renderReferenceType({
    ref: '#/properties/items/items/definitions/Status',
    context,
    renderType () {
      return 'should-inline'
    }
  }), 'ItemStatus')
})
