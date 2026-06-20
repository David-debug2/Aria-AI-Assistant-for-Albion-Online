// test/guild-strategist.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  getTerritoryStrategy,
  getZvZComposition,
  getProgressionRoadmap,
  analyzeAlliance,
} = require('../src/modules/guild-strategist');

test('Guild Strategist Module', async (t) => {
  await t.test('getTerritoryStrategy - small guild', () => {
    const result = getTerritoryStrategy({
      members: 10,
      treasury: 50000,
      experience: 'beginner',
    });
    assert(result.recommendation === 'residential' || result.recommendation === 'industrial', 'Small guild should get low-tier territory');
    assert(result.readiness !== undefined, 'Should assess readiness');
  });

  await t.test('getTerritoryStrategy - large guild', () => {
    const result = getTerritoryStrategy({
      members: 200,
      treasury: 2000000,
      experience: 'advanced',
    });
    assert.strictEqual(result.recommendation, 'industrial', 'Large guild should get industrial territory');
    assert(result.strategy.length > 0, 'Should have strategy tips');
  });

  await t.test('getZvZComposition - small scale', () => {
    const result = getZvZComposition('small');
    assert.strictEqual(result.scale, '5v5', 'Should return 5v5 composition');
    assert.strictEqual(result.totalPlayers, 5, 'Should have 5 total players');
    assert(result.roles.length > 0, 'Should list roles');
    assert(result.tactics.length > 0, 'Should have tactics');
  });

  await t.test('getZvZComposition - medium scale', () => {
    const result = getZvZComposition('medium');
    assert.strictEqual(result.scale, '15v15', 'Should return 15v15');
    assert.strictEqual(result.totalPlayers, 15, 'Should have 15 players');
  });

  await t.test('getZvZComposition - large scale', () => {
    const result = getZvZComposition('large');
    assert.strictEqual(result.scale, '40v40', 'Should return 40v40');
    assert.strictEqual(result.totalPlayers, 40, 'Should have 40 players');
  });

  await t.test('getProgressionRoadmap - beginner', () => {
    const result = getProgressionRoadmap({
      members: 15,
      experience: 'beginner',
    });
    assert(result.current, 'Should have current milestone');
    assert(result.current.actions.length > 0, 'Should have action items');
  });

  await t.test('analyzeAlliance - weak alliance', () => {
    const result = analyzeAlliance(['small', 'small']);
    assert(result.totalCombinedMembers < 100, 'Should sum alliance members');
    assert(result.strength, 'Should assess strength');
  });

  await t.test('analyzeAlliance - strong alliance', () => {
    const result = analyzeAlliance(['large', 'large', 'large']);
    assert(result.totalCombinedMembers >= 500, 'Should sum large guilds');
    assert(result.strength.includes('Strong'), 'Should be strong');
  });
});
