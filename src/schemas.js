const { SchemaType } = require('@google/generative-ai');

const nonEmptyString = { type: SchemaType.STRING };

const chatAnswerSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: nonEmptyString,
    answer: nonEmptyString,
    keyPoints: { type: SchemaType.ARRAY, items: nonEmptyString },
    recommendations: { type: SchemaType.ARRAY, items: nonEmptyString },
    warnings: { type: SchemaType.ARRAY, items: nonEmptyString },
    nextSteps: { type: SchemaType.ARRAY, items: nonEmptyString },
  },
  required: ['summary', 'answer', 'keyPoints', 'recommendations', 'warnings', 'nextSteps'],
};

const buildRecommendationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: nonEmptyString,
    build: {
      type: SchemaType.OBJECT,
      properties: {
        role: nonEmptyString,
        content: nonEmptyString,
        budget: nonEmptyString,
        gearSlots: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              slot: nonEmptyString,
              item: nonEmptyString,
              reason: nonEmptyString,
            },
            required: ['slot', 'item', 'reason'],
          },
        },
        consumables: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              type: nonEmptyString,
              item: nonEmptyString,
              reason: nonEmptyString,
            },
            required: ['type', 'item', 'reason'],
          },
        },
        rotation: { type: SchemaType.ARRAY, items: nonEmptyString },
        budgetNotes: { type: SchemaType.ARRAY, items: nonEmptyString },
      },
      required: ['role', 'content', 'budget', 'gearSlots', 'consumables', 'rotation', 'budgetNotes'],
    },
    alternatives: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item: nonEmptyString,
          replaces: nonEmptyString,
          reason: nonEmptyString,
        },
        required: ['item', 'replaces', 'reason'],
      },
    },
    warnings: { type: SchemaType.ARRAY, items: nonEmptyString },
  },
  required: ['summary', 'build', 'alternatives', 'warnings'],
};

const flipRankingSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: nonEmptyString,
    budget: nonEmptyString,
    opportunities: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          rank: { type: SchemaType.INTEGER },
          item: nonEmptyString,
          buyLocation: nonEmptyString,
          sellLocation: nonEmptyString,
          buyPrice: { type: SchemaType.INTEGER },
          sellPrice: { type: SchemaType.INTEGER },
          estimatedProfit: { type: SchemaType.INTEGER },
          profitMarginPercent: { type: SchemaType.NUMBER },
          transportRisk: nonEmptyString,
          notes: nonEmptyString,
        },
        required: [
          'rank',
          'item',
          'buyLocation',
          'sellLocation',
          'buyPrice',
          'sellPrice',
          'estimatedProfit',
          'profitMarginPercent',
          'transportRisk',
          'notes',
        ],
      },
    },
    warnings: { type: SchemaType.ARRAY, items: nonEmptyString },
  },
  required: ['summary', 'budget', 'opportunities', 'warnings'],
};

const responseSchemas = {
  chatAnswer: chatAnswerSchema,
  buildRecommendation: buildRecommendationSchema,
  flipRanking: flipRankingSchema,
};

const responseTypeByIntent = {
  build: 'buildRecommendation',
  pvp: 'buildRecommendation',
  market: 'flipRanking',
};

function getResponseTypeForIntent(intent) {
  return responseTypeByIntent[intent] || 'chatAnswer';
}

function getResponseSchema(responseType) {
  const schema = responseSchemas[responseType];
  if (!schema) throw new Error(`Unknown response schema: ${responseType}`);
  return schema;
}

function validateAgainstSchema(value, schema, path = 'response') {
  if (!schema || !schema.type) {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const type = schema.type;

  if (type === SchemaType.OBJECT) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, errors: [`${path} must be an object`] };
    }

    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }

    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) {
        const child = validateAgainstSchema(value[key], childSchema, `${path}.${key}`);
        errors.push(...child.errors);
      }
    }
  } else if (type === SchemaType.ARRAY) {
    if (!Array.isArray(value)) {
      return { valid: false, errors: [`${path} must be an array`] };
    }

    value.forEach((item, index) => {
      const child = validateAgainstSchema(item, schema.items, `${path}[${index}]`);
      errors.push(...child.errors);
    });
  } else if (type === SchemaType.STRING) {
    if (typeof value !== 'string') errors.push(`${path} must be a string`);
  } else if (type === SchemaType.INTEGER) {
    if (!Number.isInteger(value)) errors.push(`${path} must be an integer`);
  } else if (type === SchemaType.NUMBER) {
    if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`${path} must be a number`);
  } else if (type === SchemaType.BOOLEAN) {
    if (typeof value !== 'boolean') errors.push(`${path} must be a boolean`);
  }

  return { valid: errors.length === 0, errors };
}

function validateResponse(responseType, value) {
  return validateAgainstSchema(value, getResponseSchema(responseType));
}

module.exports = {
  responseSchemas,
  getResponseSchema,
  getResponseTypeForIntent,
  validateResponse,
};
