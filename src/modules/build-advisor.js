const { ask } = require('../ai-agent');

async function getBuild(role, content, budget) {
  return ask(
    `Create a complete Albion Online build for a ${role} doing ${content} with a budget of ${budget} silver.
     
     Build the answer in this order:
     1. Classify the role as frontline, backline, support, or hybrid and name the build's win condition.
     2. Select weapon, off-hand, helmet, chest, boots, cape, bag, food, and potion around that win condition.
     3. Give spell rotation and budget notes after the final gear list.
     Put the role/win-condition reasoning in summary and each gear-slot reason, then keep the gear list concrete.`,
    null,
    'build'
  );
}

async function counterBuild(enemyBuild) {
  return ask(
    `How do I counter a player running "${enemyBuild}" in open-world PvP?
     Give 2-3 counter builds with gear lists.
     For each counter, separate the countering mechanic from the final gear list:
     1. First explain the mechanic being countered and your answer to it (purge, interrupt, reflect, kite, burst window, cleanse, or sustain denial).
     2. Then list the exact weapon, off-hand, helmet, chest, boots, cape, food, and potion.
     3. Then give the rotation and the tradeoff or warning.
     Put "Countering mechanic:" before the mechanic explanation in summary or gear reasons, and put "Final gear:" before the concrete item list.`,
    null,
    'pvp'
  );
}

module.exports = { getBuild, counterBuild };
