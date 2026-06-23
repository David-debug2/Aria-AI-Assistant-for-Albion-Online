const test = require('node:test');
const assert = require('node:assert');
const { getResponseTypeForIntent, validateResponse } = require('../src/schemas');
const { MalformedModelOutputError, parseAndValidateModelJson } = require('../src/ai-agent');

test('response schemas validate handwritten examples', async (t) => {
  await t.test('chat answer example', () => {
    const example = {
      summary: 'Refining ore is a steady early silver path.',
      answer: 'Refine near the city bonus, compare raw ore against bar prices, and avoid low-margin batches.',
      keyPoints: ['Use city refining bonuses', 'Check taxes before crafting'],
      recommendations: ['Start with T4 and T5 ore'],
      warnings: ['Thin margins disappear after market tax'],
      nextSteps: ['Price one batch before refining everything'],
    };

    assert.deepStrictEqual(validateResponse('chatAnswer', example), { valid: true, errors: [] });
  });

  await t.test('build recommendation example', () => {
    const example = {
      summary: 'A cheap bruiser build gives reliable pressure in beginner PvP.',
      build: {
        role: 'DPS bruiser',
        content: 'Hellgate',
        budget: '500000 silver',
        gearSlots: [
          { slot: 'Weapon', item: 'T5 Claymore', reason: 'Strong single-target engage' },
          { slot: 'Chest', item: 'Mercenary Jacket', reason: 'Sustain during trades' },
        ],
        consumables: [
          { type: 'Food', item: 'Beef Stew', reason: 'Adds damage for burst windows' },
          { type: 'Potion', item: 'Healing Potion', reason: 'Stabilizes after engage' },
        ],
        rotation: ['Open with gap close', 'Commit burst after defensive cooldowns'],
        budgetNotes: ['Drop cape quality first if over budget'],
      },
      alternatives: [
        { item: 'Broadsword', replaces: 'Claymore', reason: 'Cheaper and easier to replace' },
      ],
      warnings: ['Avoid fighting purge-heavy matchups without cooldowns'],
    };

    assert.deepStrictEqual(validateResponse('buildRecommendation', example), { valid: true, errors: [] });
  });

  await t.test('flip ranking example', () => {
    const example = {
      summary: 'Bags have the cleanest spread in this sample.',
      budget: '1000000 silver',
      opportunities: [
        {
          rank: 1,
          item: 'T5 Bag',
          buyLocation: 'Bridgewatch',
          sellLocation: 'Caerleon',
          buyPrice: 22000,
          sellPrice: 31000,
          estimatedProfit: 7600,
          profitMarginPercent: 34.5,
          transportRisk: 'medium',
          notes: 'Good spread, but route crosses red zones.',
        },
      ],
      warnings: ['Recheck volume before buying a full stack'],
    };

    assert.deepStrictEqual(validateResponse('flipRanking', example), { valid: true, errors: [] });
  });
});

test('response schema helpers select and reject shapes', () => {
  assert.strictEqual(getResponseTypeForIntent('build'), 'buildRecommendation');
  assert.strictEqual(getResponseTypeForIntent('pvp'), 'buildRecommendation');
  assert.strictEqual(getResponseTypeForIntent('market'), 'flipRanking');
  assert.strictEqual(getResponseTypeForIntent('farming'), 'chatAnswer');

  const validation = validateResponse('chatAnswer', { answer: 'missing fields' });
  assert.strictEqual(validation.valid, false);
  assert(validation.errors.some(error => error.includes('summary')));
});

test('model JSON parser validates schema and reports malformed output', () => {
  const valid = parseAndValidateModelJson(JSON.stringify({
    summary: 'Short answer',
    answer: 'Use cheaper gear until your economy is stable.',
    keyPoints: [],
    recommendations: [],
    warnings: [],
    nextSteps: [],
  }), 'chatAnswer');

  assert.strictEqual(valid.summary, 'Short answer');

  assert.throws(
    () => parseAndValidateModelJson('not json', 'chatAnswer'),
    MalformedModelOutputError
  );

  assert.throws(
    () => parseAndValidateModelJson('{"answer":"missing required fields"}', 'chatAnswer'),
    MalformedModelOutputError
  );
});
