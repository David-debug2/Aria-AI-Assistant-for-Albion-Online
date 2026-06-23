module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  ai: {
    primaryModel: process.env.AI_MODEL || 'gemini',
    contextBudget: 64000,
    timeout: 30000,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    providers: {
      openrouter: {
        label: 'OpenRouter',
        models: [
          'openai/gpt-4o-mini',
          'anthropic/claude-3.5-haiku',
          'google/gemini-2.0-flash-001',
          'meta-llama/llama-3.1-8b-instruct'
        ]
      },
      openai: {
        label: 'OpenAI',
        models: ['gpt-4o-mini', 'gpt-4o']
      },
      anthropic: {
        label: 'Anthropic',
        models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest']
      },
      gemini: {
        label: 'Google Gemini',
        models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview']
      }
    }
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
