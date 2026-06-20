module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  ai: {
    primaryModel: process.env.AI_MODEL || 'gemini',
    contextBudget: 64000,
    timeout: 30000,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
  },
  market: {
    cacheTTL: 300000,
    servers: ['West', 'East', 'Europe'],
    defaultServer: 'West',
    retryAttempts: 3,
    retryDelay: 1000
  },
  brain: {
    filePath: './albion-brain',
    maxContextSize: 64000,
    intentKeywords: {
      farming: ['farm', 'crop', 'herb', 'island', 'yield', 'gather'],
      crafting: ['craft', 'recipe', 'refine', 'enchant', 'profit'],
      market: ['price', 'flip', 'profit', 'margin', 'buy', 'sell'],
      pvp: ['gank', 'hellgate', 'faction', 'war', 'zvz', 'duel'],
      pve: ['dungeon', 'boss', 'mob', 'expedition', 'instance'],
      guild: ['territory', 'alliance', 'war', 'warfare', 'coordination'],
      build: ['gear', 'weapon', 'armor', 'loadout', 'setup', 'counter'],
      zone: ['zone', 'map', 'mist', 'black zone', 'red zone', 'location'],
      beginner: ['new', 'start', 'tutorial', 'beginner', 'help', 'guide']
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json'
  },
  env: process.env.NODE_ENV || 'development'
};
