// src/modules/guild-strategist.js
// Provides strategic advice for guild management, territory control, and ZvZ warfare.

const { resolveItem } = require('../item-resolver');

// Territory data and strategies
const TERRITORY_STRATEGIES = {
  residential: {
    name: 'Residential Territory',
    weeklyIncome: '50-100k',
    defenseLevel: 'Low-Medium',
    taxRate: '5%',
    strategy: [
      'Good for new guilds learning territory wars',
      'Manageable 15-20 player defenses',
      'Requires minimal coordination',
      'Accept some losses as learning opportunity',
    ],
  },
  industrial: {
    name: 'Industrial Territory',
    weeklyIncome: '100-200k',
    defenseLevel: 'Medium-High',
    taxRate: '10%',
    strategy: [
      'Attracts rival guilds due to high income',
      'Requires 25-30 player squads',
      'Invest in gate/tower defenses',
      'Form alliance for support',
      'Build war fund for emergency defense',
    ],
  },
  commercial: {
    name: 'Commercial Territory',
    weeklyIncome: '150-300k',
    defenseLevel: 'Very High',
    taxRate: '15%',
    strategy: [
      'Mega-guild level competition',
      'Requires 35-50 player ZvZ armies',
      'High traffic = multiple gankers',
      'Almost impossible without strong alliance',
      'Plan for constant warfare',
    ],
  },
};

// Combat role recommendations
const ZvZ_COMPOSITIONS = {
  small: {
    scale: '5v5',
    roles: [
      { role: 'Tank', weapon: 'Mace/Shield', armor: 'Plate', quantity: 1 },
      { role: 'DPS', weapon: 'Sword', armor: 'Leather', quantity: 2 },
      { role: 'Healer', weapon: 'Holy Staff', armor: 'Cloth', quantity: 1 },
      { role: 'CC', weapon: 'Frost Staff', armor: 'Mixed', quantity: 1 },
    ],
    totalPlayers: 5,
  },
  medium: {
    scale: '15v15',
    roles: [
      { role: 'Tank', weapon: 'Mace/Shield', armor: 'Plate', quantity: 3 },
      { role: 'DPS', weapon: 'Sword/Bow', armor: 'Leather', quantity: 6 },
      { role: 'Healer', weapon: 'Holy/Nature', armor: 'Cloth', quantity: 3 },
      { role: 'CC', weapon: 'Frost/Fire', armor: 'Mixed', quantity: 3 },
    ],
    totalPlayers: 15,
  },
  large: {
    scale: '40v40',
    roles: [
      { role: 'Tank Squads', weapon: 'Mace/Shield', armor: 'Plate', quantity: 10 },
      { role: 'DPS Squads', weapon: 'Sword/Bow', armor: 'Leather', quantity: 18 },
      { role: 'Healer Squads', weapon: 'Holy/Nature', armor: 'Cloth', quantity: 8 },
      { role: 'CC Squad', weapon: 'Frost/Fire', armor: 'Mixed', quantity: 4 },
    ],
    totalPlayers: 40,
  },
};

// Guild progression milestones
const GUILD_MILESTONES = [
  {
    stage: 'Solo to Small',
    members: '5-10',
    goal: 'Learn dungeons, stable gameplay',
    actions: [
      'Recruit 5-10 active members',
      'Run 5v5 dungeons 3x/week',
      'Build 50k-100k treasury',
      'Establish guild culture & rules',
    ],
    timeline: 'Week 1-2',
  },
  {
    stage: 'Small Guild',
    members: '10-30',
    goal: 'Prepare for first territory',
    actions: [
      'Recruit 20-30 combat-ready players',
      'Train basic 5v5 hellgate strategies',
      'Accumulate 500k+ war fund',
      'Scout enemy guilds for weak territories',
      'Join temporary alliance for first war',
    ],
    timeline: 'Week 2-4',
  },
  {
    stage: 'Medium Guild (First Territory)',
    members: '30-100',
    goal: 'Hold 1-2 residential territories',
    actions: [
      'Successfully defend first territory war',
      'Establish defense rotation (24h coverage)',
      'Tax income = 50-200k/week',
      'Recruit specialist roles (tanks, healers)',
      'Create squad organization structure',
    ],
    timeline: 'Week 4-8',
  },
  {
    stage: 'Growing Guild',
    members: '100-200',
    goal: 'Upgrade to industrial territory',
    actions: [
      'Attack rival guild for industrial territory',
      'Manage 2-3 territories',
      'Tax income = 200-500k/week',
      'Build alliance network',
      'Invest in guild hall upgrades',
    ],
    timeline: 'Week 8-16',
  },
  {
    stage: 'Established Guild',
    members: '200-400',
    goal: 'Control 5+ territories',
    actions: [
      'Dominate regional territory control',
      'Tax income = 500k-2m/week',
      'Lead alliance (5+ guild coalition)',
      'Participate in seasonal battles',
      'Mentor younger guilds',
    ],
    timeline: 'Month 4+',
  },
];

/**
 * Get territory strategy recommendations based on guild size and resources.
 *
 * @param {object} guildStats - { members, treasury, experience }
 * @returns {object} - Territory recommendation and strategy
 */
function getTerritoryStrategy(guildStats = {}) {
  const { members = 30, treasury = 100000, experience = 'beginner' } = guildStats;

  let recommendation = null;

  if (members < 15 || experience === 'beginner') {
    recommendation = 'residential';
  } else if (members >= 15 && members < 50) {
    recommendation = 'industrial';
  } else {
    recommendation = 'commercial';
  }

  const strategy = TERRITORY_STRATEGIES[recommendation];

  return {
    recommendation,
    ...strategy,
    guildStats,
    requirements: {
      minimumMembers: recommendation === 'residential' ? 15 : recommendation === 'industrial' ? 25 : 40,
      minimumTreasury: recommendation === 'residential' ? 100000 : recommendation === 'industrial' ? 500000 : 2000000,
      requiredExperience: recommendation === 'residential' ? 'beginner' : recommendation === 'industrial' ? 'intermediate' : 'advanced',
    },
    readiness: {
      membersOk: members >= (recommendation === 'residential' ? 15 : recommendation === 'industrial' ? 25 : 40),
      treasuryOk: treasury >= (recommendation === 'residential' ? 100000 : recommendation === 'industrial' ? 500000 : 2000000),
      experienceOk: experience !== 'complete_beginner',
    },
  };
}

/**
 * Get ZvZ fleet composition for different battle scales.
 *
 * @param {string} scale - 'small' (5v5), 'medium' (15v15), 'large' (40v40)
 * @returns {object} - Composition roles and strategy
 */
function getZvZComposition(scale = 'small') {
  const composition = ZvZ_COMPOSITIONS[scale];

  if (!composition) {
    return {
      error: `Unknown scale: ${scale}. Use 'small', 'medium', or 'large'`,
    };
  }

  return {
    scale: composition.scale,
    totalPlayers: composition.totalPlayers,
    roles: composition.roles,
    tactics: getTacticsForScale(scale),
    preparation: getPreparationForScale(scale),
  };
}

function getTacticsForScale(scale) {
  const tactics = {
    small: [
      '1. Front engage: Tank advances, draws enemy focus',
      '2. Flank: DPS squad hits from side angle',
      '3. Heal focus: Healer keeps tank alive',
      '4. CC chain: Frost → Root → Stun for lockdown',
      '5. Focus fire: All DPS target one enemy at a time',
    ],
    medium: [
      '1. Split squads: Tank + 2 DPS + Healer = unit (3x)',
      '2. Advance formation: Tanks in front, DPS behind, healer back',
      '3. Priority targets: Kill enemy healers first',
      '4. Potions & buffs: Coordinate item usage for big moments',
      '5. Retreat & regroup: Don\'t chase kills, maintain formation',
    ],
    large: [
      '1. Command structure: Assign squad leaders',
      '2. Flanking maneuvers: Use map terrain for advantage',
      '3. Healing rotation: Healers cover zones, not individual targets',
      '4. Supply chain: Bring potions, food, repair kits',
      '5. Adapt tactics: React to enemy composition changes',
    ],
  };
  return tactics[scale] || [];
}

function getPreparationForScale(scale) {
  const prep = {
    small: [
      'Stock 50 Healing Potions (1k each)',
      'Stock 50 Mana Potions (1k each)',
      'Stock 100 Food items (2k each)',
      'Total prep cost: ~350k',
    ],
    medium: [
      'Stock 200 Healing Potions (1k each)',
      'Stock 200 Mana Potions (1k each)',
      'Stock 300 Food items (2k each)',
      'Total prep cost: ~900k',
    ],
    large: [
      'Stock 800 Healing Potions (1k each)',
      'Stock 800 Mana Potions (1k each)',
      'Stock 1000 Food items (2k each)',
      'Backup gear (100 sets @ 500k)',
      'Total prep cost: ~2.8m',
    ],
  };
  return prep[scale] || [];
}

/**
 * Get guild progression roadmap.
 *
 * @param {object} currentState - { members, experience, territories }
 * @returns {object} - Roadmap to next stage and recommended actions
 */
function getProgressionRoadmap(currentState = {}) {
  const { members = 20, experience = 'beginner', territories = 0 } = currentState;

  let currentMilestone = null;
  let nextMilestone = null;

  for (let i = 0; i < GUILD_MILESTONES.length; i++) {
    const milestone = GUILD_MILESTONES[i];
    if (
      (i === 0 && members <= 30) ||
      (i === 1 && members > 10 && members <= 30) ||
      (i === 2 && members > 30 && members <= 100) ||
      (i === 3 && members > 100 && members <= 200) ||
      (i === 4 && members > 200)
    ) {
      currentMilestone = milestone;
      nextMilestone = GUILD_MILESTONES[i + 1] || null;
      break;
    }
  }

  return {
    current: currentMilestone,
    next: nextMilestone,
    progressEstimate: nextMilestone
      ? `${currentMilestone.timeline} → ${nextMilestone.timeline}`
      : 'You have reached elite status!',
    immediateActions: currentMilestone?.actions || [],
  };
}

/**
 * Analyze alliance partnerships.
 *
 * @param {string[]} allyGuildSizes - ['large', 'medium', 'small']
 * @returns {object} - Alliance strength analysis
 */
function analyzeAlliance(allyGuildSizes = []) {
  const totalMembers = {
    small: 30,
    medium: 100,
    large: 250,
  };

  const combinedMembers = allyGuildSizes.reduce((sum, size) => {
    return sum + (totalMembers[size] || 0);
  }, 0);

  return {
    members: allyGuildSizes,
    totalCombinedMembers: combinedMembers,
    strength:
      combinedMembers >= 500
        ? 'Mega-alliance (Can control region)'
        : combinedMembers >= 250
        ? 'Strong alliance (Can win territory wars)'
        : combinedMembers >= 100
        ? 'Weak alliance (High risk of losing wars)'
        : 'Too small (Likely to be defeated)',
    recommendation:
      combinedMembers >= 500
        ? 'You can attack commercial territories'
        : combinedMembers >= 250
        ? 'You can attack industrial territories'
        : 'Focus on residential territories only',
  };
}

module.exports = {
  getTerritoryStrategy,
  getZvZComposition,
  getProgressionRoadmap,
  analyzeAlliance,
  TERRITORY_STRATEGIES,
  GUILD_MILESTONES,
  ZvZ_COMPOSITIONS,
};
