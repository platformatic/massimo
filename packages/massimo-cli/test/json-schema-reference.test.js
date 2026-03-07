import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { renderReferenceType } from '../lib/json-schema/reference.js'
import { createRenderContext, createChildRenderContext } from '../lib/json-schema/render-context.js'
import { scanJSONSchema } from '../lib/json-schema/scanner.js'

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

test('renderReferenceType uses scanned registry names for internal refs', () => {
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
