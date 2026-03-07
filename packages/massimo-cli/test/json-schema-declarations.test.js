import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { buildDeclarations, renderDeclarations } from '../lib/json-schema/declarations.js'
import { scanJSONSchema } from '../lib/json-schema/scanner.js'

test('buildDeclarations emits interfaces and type aliases for named paths', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Claim',
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid'
        },
        data: {
          type: 'object',
          properties: {
            status: {
              enum: ['ACTIVE', 'INACTIVE']
            }
          }
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })

  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Claim {',
    '  id: ClaimId;',
    '  data?: ClaimData;',
    '}',
    '',
    '/**',
    ' * Expected format: JSON Schema uuid',
    ' */',
    'type ClaimId = string;',
    '',
    'interface ClaimData {',
    '  status?: ClaimDataStatus;',
    '}',
    '',
    'type ClaimDataStatus = \'ACTIVE\' | \'INACTIVE\';',
    '',
    'export { Claim };',
    ''
  ].join('\n'))
})
