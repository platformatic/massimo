import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { buildDeclarations, renderDeclarations } from '../lib/json-schema/declarations/index.js'
import { scanJSONSchema } from '../lib/json-schema/core/index.js'

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
    '  id: Id;',
    '  data?: Data;',
    '}',
    '/**',
    ' * Expected format: JSON Schema uuid',
    ' */',
    'type Id = string;',
    'interface Data {',
    '  status?: DataStatus;',
    '}',
    '',
    'type DataStatus = \'ACTIVE\' | \'INACTIVE\';',
    '',
    'export { Claim };',
    ''
  ].join('\n'))
})

test('buildDeclarations keeps repeated object shapes on deterministic local names', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Programme',
      type: 'object',
      required: ['validity', 'rules'],
      properties: {
        validity: {
          type: 'object',
          required: ['startAt', 'endAt'],
          properties: {
            startAt: { type: 'string' },
            endAt: { type: 'string' }
          }
        },
        rules: {
          type: 'array',
          items: {
            type: 'object',
            required: ['validity'],
            properties: {
              validity: {
                type: 'object',
                required: ['startAt', 'endAt'],
                properties: {
                  startAt: { type: 'string' },
                  endAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Programme {',
    '  validity: Validity;',
    '  rules: Array<Rule>;',
    '}',
    '',
    'interface Validity {',
    '  startAt: ValidityStartAt;',
    '  endAt: ValidityEndAt;',
    '}',
    '',
    'type ValidityStartAt = string;',
    'type ValidityEndAt = string;',
    'interface Rule {',
    '  validity: RuleValidity;',
    '}',
    '',
    'interface RuleValidity {',
    '  startAt: RuleValidityStartAt;',
    '  endAt: RuleValidityEndAt;',
    '}',
    '',
    'type RuleValidityStartAt = string;',
    'type RuleValidityEndAt = string;',
    '',
    'export { Programme };',
    ''
  ].join('\n'))
})

test('buildDeclarations emits base and branch interfaces for object unions', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Programme',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          enum: ['LOYALTY', 'CAMPAIGN']
        },
        code: {
          type: 'string'
        }
      },
      oneOf: [
        {
          type: 'object',
          required: ['type', 'earning'],
          properties: {
            type: { const: 'LOYALTY' },
            earning: { type: 'string' }
          }
        },
        {
          type: 'object',
          required: ['type', 'messaging'],
          properties: {
            type: { const: 'CAMPAIGN' },
            messaging: { type: 'boolean' }
          }
        }
      ]
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface BaseProgramme {',
    '  type: Type;',
    '  code?: Code;',
    '}',
    '',
    "type Type = 'LOYALTY' | 'CAMPAIGN';",
    'type Code = string;',
    'interface LoyaltyProgramme extends BaseProgramme {',
    "  type: 'LOYALTY';",
    '  earning: LoyaltyProgrammeEarning;',
    '}',
    '',
    'type LoyaltyProgrammeEarning = string;',
    'interface CampaignProgramme extends BaseProgramme {',
    "  type: 'CAMPAIGN';",
    '  messaging: CampaignProgrammeMessaging;',
    '}',
    '',
    'type CampaignProgrammeMessaging = boolean;',
    'type Programme = LoyaltyProgramme | CampaignProgramme;',
    '',
    'export { Programme };',
    ''
  ].join('\n'))
})

test('buildDeclarations collapses single-branch object unions into one declaration', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Provider',
      type: 'object',
      required: ['config'],
      properties: {
        config: {
          type: 'object',
          required: ['sourceSystem', 'discountId'],
          properties: {
            sourceSystem: {
              enum: ['SDM']
            },
            discountId: {
              type: 'number'
            }
          },
          oneOf: [
            {
              type: 'object',
              required: ['sourceSystem'],
              properties: {
                sourceSystem: {
                  const: 'SDM'
                }
              }
            }
          ]
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Provider {',
    '  config: Config;',
    '}',
    '',
    'interface Config {',
    '  discountId: ConfigDiscountId;',
    '  sourceSystem: ConfigSourceSystem;',
    '}',
    '',
    'type ConfigDiscountId = number;',
    "type ConfigSourceSystem = 'SDM';",
    '',
    'export { Provider };',
    ''
  ].join('\n'))
})

test('buildDeclarations still emits omitted union property aliases', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Offer',
      type: 'object',
      required: ['type', 'value'],
      properties: {
        type: {
          enum: ['TENDER', 'SERVICE']
        },
        value: {}
      },
      oneOf: [
        {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { const: 'TENDER' },
            value: {
              type: 'object',
              properties: {
                amount: { type: 'string' }
              }
            }
          }
        },
        {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { const: 'SERVICE' },
            value: {
              type: 'object',
              properties: {}
            }
          }
        }
      ]
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface BaseOffer {',
    '  type: Type;',
    '}',
    '',
    "type Type = 'TENDER' | 'SERVICE';",
    'type Value = OfferTenderValue | OfferServiceValue;',
    'interface OfferTenderValue {',
    '  amount?: OfferTenderValueAmount;',
    '}',
    '',
    'type OfferTenderValueAmount = string;',
    'type OfferServiceValue = Record<string, unknown>;',
    'interface TenderOffer extends BaseOffer {',
    "  type: 'TENDER';",
    '  value: OfferTenderValue;',
    '}',
    '',
    'interface ServiceOffer extends BaseOffer {',
    "  type: 'SERVICE';",
    '  value: OfferServiceValue;',
    '}',
    '',
    'type Offer = TenderOffer | ServiceOffer;',
    '',
    'export { Offer };',
    ''
  ].join('\n'))
})

test('buildDeclarations inlines nested scalar array properties with singular item aliases', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Lifecycle',
      type: 'object',
      properties: {
        constraints: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                enum: ['CHANNELS', 'CODE']
              }
            },
            oneOf: [
              {
                type: 'object',
                required: ['type', 'channels'],
                properties: {
                  type: { const: 'CHANNELS' },
                  channels: {
                    type: 'array',
                    items: {
                      enum: ['ONLINE', 'STORE']
                    }
                  }
                }
              },
              {
                type: 'object',
                required: ['type', 'code'],
                properties: {
                  type: { const: 'CODE' },
                  code: {
                    type: 'string'
                  }
                }
              }
            ]
          }
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Lifecycle {',
    '  constraints?: Array<Constraint>;',
    '}',
    '',
    'type Constraint = ChannelsConstraint | CodeConstraint;',
    "type ConstraintType = 'CHANNELS' | 'CODE';",
    'interface ChannelsConstraint {',
    "  type: 'CHANNELS';",
    '  channels: Array<ChannelsConstraintChannel>;',
    '}',
    '',
    "type ChannelsConstraintChannel = 'ONLINE' | 'STORE';",
    'interface CodeConstraint {',
    "  type: 'CODE';",
    '  code: CodeConstraintCode;',
    '}',
    '',
    'type CodeConstraintCode = string;',
    '',
    'export { Lifecycle };',
    ''
  ].join('\n'))
})

test('buildDeclarations inlines formatted duplicate-suffix scalar properties in nested union branches', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Lifecycle',
      type: 'object',
      definitions: {
        ExpirationDate: {
          type: 'object',
          required: ['type', 'date'],
          properties: {
            type: { const: 'DATE' },
            date: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ExpirationDuration: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { const: 'DURATION' },
            value: {
              type: 'number',
              minimum: 0
            }
          }
        }
      },
      properties: {
        expiration: {
          type: 'object',
          description: 'Expiration config',
          required: ['type'],
          properties: {
            type: {
              enum: ['DATE', 'DURATION']
            }
          },
          oneOf: [
            {
              $ref: '#/definitions/ExpirationDate'
            },
            {
              $ref: '#/definitions/ExpirationDuration'
            }
          ]
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Lifecycle {',
    '  expiration?: Expiration;',
    '}',
    '/**',
    ' * Expiration config',
    ' */',
    'type Expiration = ExpirationDate | ExpirationDuration;',
    'interface ExpirationDate {',
    "  type: 'DATE';",
    '  /**',
    '   * Expected format: JSON Schema date-time',
    '   */',
    '  date: string;',
    '}',
    '',
    'interface ExpirationDuration {',
    "  type: 'DURATION';",
    '  value: ExpirationDurationValue;',
    '}',
    '/**',
    ' * Expected minimum: 0',
    ' */',
    'type ExpirationDurationValue = number;',
    '',
    'export { Lifecycle };',
    ''
  ].join('\n'))
})

test('buildDeclarations shares repeated enum aliases within nested union branch values', () => {
  const state = scanJSONSchema({
    schema: {
      title: 'Offer',
      type: 'object',
      properties: {
        realisationCost: {
          type: 'object',
          required: ['currencyCode'],
          properties: {
            currencyCode: {
              type: 'string',
              enum: ['EUR', 'USD']
            }
          }
        },
        value: {
          required: ['type'],
          properties: {
            type: {
              enum: ['TENDER', 'FIXED_DISCOUNT', 'FIXED_PRICE']
            }
          },
          oneOf: [
            {
              type: 'object',
              required: ['type', 'currencyCode'],
              properties: {
                type: { const: 'TENDER' },
                currencyCode: {
                  type: 'string',
                  enum: ['EUR', 'USD']
                }
              }
            },
            {
              type: 'object',
              required: ['type', 'currencyCode'],
              properties: {
                type: { const: 'FIXED_DISCOUNT' },
                currencyCode: {
                  type: 'string',
                  enum: ['EUR', 'USD']
                }
              }
            },
            {
              type: 'object',
              required: ['type', 'currencyCode'],
              properties: {
                type: { const: 'FIXED_PRICE' },
                currencyCode: {
                  type: 'string',
                  enum: ['EUR', 'USD']
                }
              }
            }
          ]
        }
      }
    }
  })

  const declarations = buildDeclarations({ state })
  equal(renderDeclarations({ declarations, rootName: state.rootName }), [
    'interface Offer {',
    '  realisationCost?: RealisationCost;',
    '  value?: Value;',
    '}',
    '',
    'interface RealisationCost {',
    '  currencyCode: RealisationCostCurrencyCode;',
    '}',
    '',
    "type RealisationCostCurrencyCode = 'EUR' | 'USD';",
    'type Value = ValueTenderValue | ValueFixedDiscountValue | ValueFixedPriceValue;',
    'interface ValueTenderValue {',
    "  type: 'TENDER';",
    '  currencyCode: ValueCurrencyCode;',
    '}',
    '',
    "type ValueCurrencyCode = 'EUR' | 'USD';",
    'interface ValueFixedDiscountValue {',
    "  type: 'FIXED_DISCOUNT';",
    '  currencyCode: ValueCurrencyCode_1;',
    '}',
    '',
    "type ValueCurrencyCode_1 = 'EUR' | 'USD';",
    'interface ValueFixedPriceValue {',
    "  type: 'FIXED_PRICE';",
    '  currencyCode: ValueCurrencyCode_2;',
    '}',
    '',
    "type ValueCurrencyCode_2 = 'EUR' | 'USD';",
    '',
    'export { Offer };',
    ''
  ].join('\n'))
})
