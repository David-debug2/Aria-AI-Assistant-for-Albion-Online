const { ask } = require('../ai-agent');

async function getBuild(role, content, budget) {
  return ask(
    `Create a complete Albion Online build for a ${role} doing ${content} with a budget of ${budget} silver.
     
     Format your response as:
     ## Build Overview
     ## Gear Slots (weapon, off-hand, helmet, chest, boots, cape, bag)
     ## Food & Potion
     ## Spell Rotation
     ## Budget Notes (cheaper alternatives if budget is tight)`,
    null,
    'build'
  );
}

async function counterBuild(enemyBuild) {
  return ask(
    `How do I counter a player running "${enemyBuild}" in open-world PvP?
     Give 2-3 counter builds with gear lists, and explain the countering mechanic for each.`,
    null,
    'pvp'
  );
}

module.exports = { getBuild, counterBuild };