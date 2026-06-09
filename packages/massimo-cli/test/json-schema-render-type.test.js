import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderContext, renderType } from '../lib/json-schema/render/index.js'
import { scanJSONSchema } from '../lib/json-schema/core/index.js'

test('renderType handles primitive schema types', () => {
  equal(renderInlineType({ schema: { type: 'string' } }), 'string')
  equal(renderInlineType({ schema: { type: 'integer' } }), 'number')
  equal(renderInlineType({ schema: { type: 'boolean' } }), 'boolean')
  equal(renderInlineType({ schema: { type: 'null' } }), 'null')
})

test('renderType handles consts, enums, and union type arrays', () => {
  equal(renderInlineType({ schema: { const: 'ACTIVE' } }), '"ACTIVE"')
  equal(renderInlineType({ schema: { enum: ['A', 'B', 2] } }), "'A' | 'B' | 2")
  equal(renderInlineType({ schema: { type: ['string', 'null'] } }), 'string | null')
})

test('renderType handles refs through the scanned registry', () => {
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
          type: 'string'
        }
      }
    }
  })

  const context = createRenderContext({
    schema: state.rootSchema.properties.payload,
    state,
    path: '#/properties/payload',
    lookupPathName: false
  })

  equal(renderType({ context }), 'Payload')
})

test('renderType inlines direct array properties when the item type is already named', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Envelope',
      type: 'object',
      properties: {
        payloads: {
          type: 'array',
          items: {
            title: 'Payload',
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          }
        }
      }
    }
  })

  const context = createRenderContext({
    schema: state.rootSchema.properties.payloads,
    state,
    path: '#/properties/payloads'
  })

  equal(renderType({ context }), 'Array<Payload>')
})

test('renderType handles arrays and tuples', () => {
  equal(renderInlineType({
    schema: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }), 'Array<string>')

  equal(renderInlineType({
    schema: {
      type: 'array',
      items: [
        { type: 'string' },
        { type: 'integer' }
      ]
    }
  }), '[string, number]')
})

test('renderType parenthesizes complex array item types', () => {
  equal(renderInlineType({
    schema: {
      type: 'array',
      items: {
        enum: ['A', 'B']
      }
    }
  }), "Array<('A' | 'B')>")
})

test('renderType handles object properties and required fields', () => {
  equal(renderInlineType({
    schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        active: { type: 'boolean' }
      }
    }
  }), '{\n  id: string;\n  active?: boolean;\n}')
})

test('renderType handles nested inline objects when child lookup is disabled', () => {
  equal(renderInlineType({
    schema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  }), '{\n  profile?: {\n  id: string;\n};\n}')
})

test('renderType handles object index signatures', () => {
  equal(renderInlineType({
    schema: {
      type: 'object',
      additionalProperties: {
        enum: ['A', 'B']
      }
    }
  }), "Record<string, 'A' | 'B'>")

  equal(renderInlineType({
    schema: {
      type: 'object',
      patternProperties: {
        '^[a-z]+$': {
          type: 'string'
        }
      }
    }
  }), 'Record<string, string>')
})

test('renderType handles oneOf and anyOf unions', () => {
  equal(renderInlineType({
    schema: {
      oneOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    }
  }), 'string | number')

  equal(renderInlineType({
    schema: {
      anyOf: [
        { enum: ['A', 'B'] },
        { type: 'null' }
      ]
    }
  }), "'A' | 'B' | null")
})

test('renderType handles allOf intersections', () => {
  equal(renderInlineType({
    schema: {
      allOf: [
        { type: 'string' },
        { enum: ['A', 'B'] }
      ]
    }
  }), "string & ('A' | 'B')")
})

test('renderType combines object properties with combinators', () => {
  equal(renderInlineType({
    schema: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string' }
      },
      oneOf: [
        {
          type: 'object',
          required: ['value'],
          properties: {
            value: { type: 'number' }
          }
        },
        {
          type: 'object',
          required: ['value'],
          properties: {
            value: { type: 'string' }
          }
        }
      ]
    }
  }), '{\n  type: string;\n} & ({\n  value: number;\n} | {\n  value: string;\n})')
})

function renderInlineType ({ schema }) {
  const state = scanJSONSchema({
    schema: {
      title: 'Inline',
      ...schema
    }
  })

  return renderType({
    context: createRenderContext({
      schema,
      state,
      lookupPathName: false,
      lookupChildPathNames: false
    })
  })
}
