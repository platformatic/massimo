import { equal } from 'node:assert'
import { test } from 'node:test'
import CodeBlockWriter from 'code-block-writer'
import { writeObjectProperties } from '../lib/openapi-common.js'

test('writeObjectProperties should handle complex additionalProperties', async () => {
  const schema = {
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['READ', 'UPDATE']
      }
    }
  }
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  const addedProps = new Set()
  writeObjectProperties(writer, schema, {}, addedProps, 'req', false)
  const output = writer.toString()
  equal(output, "[key: string]: Array<'READ' | 'UPDATE'>;\n")
})

test('writeObjectProperties should handle additionalProperties: true', async () => {
  const schema = {
    type: 'object',
    additionalProperties: true
  }
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  const addedProps = new Set()
  writeObjectProperties(writer, schema, {}, addedProps, 'req', false)
  const output = writer.toString()
  equal(output, '[key: string]: unknown;\n')
})

test('writeObjectProperties should handle both properties and additionalProperties', async () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { type: 'string' }
    },
    required: ['foo'],
    additionalProperties: {
      type: 'number'
    }
  }
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  const addedProps = new Set()
  writeObjectProperties(writer, schema, {}, addedProps, 'req', false)
  const output = writer.toString()
  equal(output, "'foo': string;\n[key: string]: number;\n")
})

test('writeObjectProperties should handle multi-level $ref resolution', async () => {
  const spec = {
    components: {
      schemas: {
        ActualObject: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        Alias1: {
          $ref: '#/components/schemas/ActualObject'
        }
      }
    }
  }

  const schema = { $ref: '#/components/schemas/Alias1' }
  const writer = new CodeBlockWriter({
    indentNumberOfSpaces: 2,
    useTabs: false,
    useSingleQuote: true
  })
  const addedProps = new Set()

  writeObjectProperties(writer, schema, spec, addedProps, 'req', false)
  const output = writer.toString()
  equal(output, "'id': string;\n")
})
