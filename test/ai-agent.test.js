const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const chatAnswer = {
  summary: 'Summary',
  answer: 'Answer',
  keyPoints: [],
  recommendations: [],
  warnings: [],
  nextSteps: [],
};

function loadAiAgentWithBrainStub(loadBrainContext, env = {}) {
  const brainLoaderPath = path.resolve(__dirname, '..', 'src', 'brain-loader.js');
  const aiAgentPath = path.resolve(__dirname, '..', 'src', 'ai-agent.js');
  const previousEnv = {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  delete require.cache[aiAgentPath];
  process.env.GOOGLE_API_KEY = '';
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  Object.assign(process.env, env);

  require.cache[brainLoaderPath] = {
    id: brainLoaderPath,
    filename: brainLoaderPath,
    loaded: true,
    exports: { loadBrainContext },
  };

  const aiAgent = require('../src/ai-agent');

  return {
    aiAgent,
    cleanup() {
      delete require.cache[aiAgentPath];
      delete require.cache[brainLoaderPath];
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

function stubBrain(intent = 'summarize') {
  return async (query, forceIntent) => ({
    context: 'Stub brain context',
    intent: forceIntent || intent,
    filesLoaded: ['stub.md'],
  });
}

test('AI provider fallback chain', async (t) => {
  await t.test('reasoning instructions are conditional by intent', async () => {
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain());
    try {
      const summarizePrompt = aiAgent.getSystemPrompt('summarize');
      const buildPrompt = aiAgent.getSystemPrompt('build');
      const pvpPrompt = aiAgent.getSystemPrompt('pvp');
      const guildPrompt = aiAgent.getSystemPrompt('guild');

      assert.doesNotMatch(summarizePrompt, /visible reasoning order/);
      assert.doesNotMatch(summarizePrompt, /frontline\/backline\/support/);
      assert.match(buildPrompt, /For build requests/);
      assert.match(buildPrompt, /frontline\/backline\/support/);
      assert.match(pvpPrompt, /For PvP counter-build requests/);
      assert.match(pvpPrompt, /countering mechanic first/);
      assert.match(guildPrompt, /For guild strategy requests/);
      assert.match(guildPrompt, /frontline requirements/);
    } finally {
      cleanup();
    }
  });

  await t.test('first provider success returns OpenRouter engine metadata', async () => {
    const calls = [];
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain());
    const resetProviders = aiAgent.__setTestProviders({
      askOpenRouter: async (prompt, model) => {
        calls.push(['openrouter', model, prompt]);
        return JSON.stringify(chatAnswer);
      },
      askCloudflare: async () => {
        calls.push(['cloudflare']);
        return JSON.stringify(chatAnswer);
      },
      askOllama: async () => {
        calls.push(['ollama']);
        return JSON.stringify(chatAnswer);
      },
      askGemini: async () => {
        calls.push(['gemini']);
        return chatAnswer;
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    const result = await aiAgent.ask('Narrate this computed JSON', { rankedOpportunities: [] }, 'summarize');

    assert.deepStrictEqual(calls.map(call => call[0]), ['openrouter']);
    assert.match(calls[0][2], /LIVE MARKET DATA/);
    assert.match(calls[0][2], /rankedOpportunities/);
    assert.strictEqual(result.engine, 'openrouter');
    assert.strictEqual(result.intent, 'summarize');
    assert.strictEqual(result.responseType, 'chatAnswer');
    assert.deepStrictEqual(result.response, chatAnswer);
  });

  await t.test('429-class OpenRouter failure falls through to Cloudflare', async () => {
    const calls = [];
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain());
    const resetProviders = aiAgent.__setTestProviders({
      askOpenRouter: async () => {
        calls.push('openrouter');
        const err = new aiAgent.ProviderRequestError('rate limited', 429, 'openrouter');
        throw err;
      },
      askCloudflare: async () => {
        calls.push('cloudflare');
        return JSON.stringify(chatAnswer);
      },
      askOllama: async () => {
        calls.push('ollama');
        return JSON.stringify(chatAnswer);
      },
      askGemini: async () => {
        calls.push('gemini');
        return chatAnswer;
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    const result = await aiAgent.ask('Summarize this data', null, 'summarize');

    assert.deepStrictEqual(calls, ['openrouter', 'cloudflare']);
    assert.strictEqual(result.engine, 'cloudflare');
    assert.deepStrictEqual(result.response, chatAnswer);
  });

  await t.test('400-class provider error stops fallback and surfaces the error', async () => {
    const calls = [];
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain());
    const resetProviders = aiAgent.__setTestProviders({
      askOpenRouter: async () => {
        calls.push('openrouter');
        throw new aiAgent.ProviderRequestError('bad request', 400, 'openrouter');
      },
      askCloudflare: async () => {
        calls.push('cloudflare');
        return JSON.stringify(chatAnswer);
      },
      askOllama: async () => {
        calls.push('ollama');
        return JSON.stringify(chatAnswer);
      },
      askGemini: async () => {
        calls.push('gemini');
        return chatAnswer;
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    await assert.rejects(
      () => aiAgent.ask('Summarize this data', null, 'summarize'),
      err => err.name === 'ProviderRequestError' && err.status === 400
    );
    assert.deepStrictEqual(calls, ['openrouter']);
  });

  await t.test('all providers exhausted throws a chain error', async () => {
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain());
    const resetProviders = aiAgent.__setTestProviders({
      askOpenRouter: async () => null,
      askCloudflare: async () => null,
      askOllama: async () => null,
      askGemini: async () => null,
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    await assert.rejects(
      () => aiAgent.ask('Summarize this data', null, 'summarize'),
      err => err.name === 'ProviderChainError' && err.failures.length === 4
    );
  });

  await t.test('OpenRouter quota threshold skips network and routes to Cloudflare', async () => {
    const previousFetch = globalThis.fetch;
    const fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: JSON.stringify(chatAnswer) } }],
        }),
      };
    };

    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(stubBrain(), {
      OPENROUTER_API_KEY: 'openrouter-key',
      CLOUDFLARE_API_TOKEN: 'cloudflare-token',
      CLOUDFLARE_ACCOUNT_ID: 'cloudflare-account',
    });
    aiAgent.__openRouterQuotaForTests.setState({ calls: 45 });
    t.after(() => {
      globalThis.fetch = previousFetch;
      aiAgent.__openRouterQuotaForTests.reset();
      cleanup();
    });

    const result = await aiAgent.ask('Summarize this data', null, 'summarize');

    assert.deepStrictEqual(fetchCalls, [
      'https://api.cloudflare.com/client/v4/accounts/cloudflare-account/ai/v1/chat/completions',
    ]);
    assert.strictEqual(result.engine, 'cloudflare');
    assert.deepStrictEqual(result.response, chatAnswer);
  });
});
