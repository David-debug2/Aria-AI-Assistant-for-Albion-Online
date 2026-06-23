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

function loadAiAgentWithBrainStub(loadBrainContext) {
  const brainLoaderPath = path.resolve(__dirname, '..', 'src', 'brain-loader.js');
  const aiAgentPath = path.resolve(__dirname, '..', 'src', 'ai-agent.js');
  const previousGoogleApiKey = process.env.GOOGLE_API_KEY;

  delete require.cache[aiAgentPath];
  process.env.GOOGLE_API_KEY = '';
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
      if (previousGoogleApiKey === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = previousGoogleApiKey;
      }
    },
  };
}

test('AI agent Ollama routing', async (t) => {
  await t.test('forced summarize intent reaches the Ollama branch', async () => {
    let ollamaCall = null;
    let geminiCalls = 0;
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(async (query, forceIntent) => ({
      context: 'Stub brain context',
      intent: forceIntent || 'market',
      filesLoaded: ['stub.md'],
    }));
    const resetProviders = aiAgent.__setTestProviders({
      askOllama: async (prompt, model) => {
        ollamaCall = { prompt, model };
        return JSON.stringify(chatAnswer);
      },
      askGemini: async () => {
        geminiCalls += 1;
        return chatAnswer;
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    const result = await aiAgent.ask('Narrate this computed JSON', { rankedOpportunities: [] }, 'summarize');

    assert(ollamaCall, 'Ollama should be called');
    assert.strictEqual(ollamaCall.model, 'qwen3.6');
    assert.match(ollamaCall.prompt, /LIVE MARKET DATA/);
    assert.match(ollamaCall.prompt, /rankedOpportunities/);
    assert.strictEqual(geminiCalls, 0);
    assert.strictEqual(result.engine, 'ollama');
    assert.strictEqual(result.intent, 'summarize');
    assert.strictEqual(result.responseType, 'chatAnswer');
    assert.deepStrictEqual(result.response, chatAnswer);
  });

  await t.test('unforced market intent stays on Gemini Flash', async () => {
    let ollamaCalls = 0;
    let geminiCall = null;
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(async (query, forceIntent) => ({
      context: 'Stub market context',
      intent: forceIntent || 'market',
      filesLoaded: ['market.md'],
    }));
    const resetProviders = aiAgent.__setTestProviders({
      askOllama: async () => {
        ollamaCalls += 1;
        return JSON.stringify(chatAnswer);
      },
      askGemini: async (prompt, model, responseType) => {
        geminiCall = { prompt, model, responseType };
        return { summary: 'Market answer' };
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    const result = await aiAgent.ask('Where should I sell T5 bags?');

    assert.strictEqual(ollamaCalls, 0);
    assert(geminiCall, 'Gemini should be called');
    assert.strictEqual(geminiCall.model, 'gemini-3.5-flash');
    assert.strictEqual(geminiCall.responseType, 'flipRanking');
    assert.strictEqual(result.engine, 'gemini-flash');
    assert.strictEqual(result.intent, 'market');
    assert.strictEqual(result.responseType, 'flipRanking');
  });

  await t.test('failed Ollama call falls back to Gemini Flash with summarize metadata', async () => {
    let ollamaCalls = 0;
    let geminiCall = null;
    const { aiAgent, cleanup } = loadAiAgentWithBrainStub(async (query, forceIntent) => ({
      context: 'Stub brain context',
      intent: forceIntent || 'market',
      filesLoaded: ['stub.md'],
    }));
    const resetProviders = aiAgent.__setTestProviders({
      askOllama: async () => {
        ollamaCalls += 1;
        return null;
      },
      askGemini: async (prompt, model, responseType) => {
        geminiCall = { prompt, model, responseType };
        return chatAnswer;
      },
    });
    t.after(() => {
      resetProviders();
      cleanup();
    });

    const result = await aiAgent.ask('Narrate this computed JSON', { trendSummary: {} }, 'summarize');

    assert.strictEqual(ollamaCalls, 1);
    assert(geminiCall, 'Gemini fallback should be called');
    assert.strictEqual(geminiCall.model, 'gemini-3.5-flash');
    assert.strictEqual(geminiCall.responseType, 'chatAnswer');
    assert.strictEqual(result.engine, 'gemini-flash (ollama fallback)');
    assert.strictEqual(result.intent, 'summarize');
    assert.deepStrictEqual(result.response, chatAnswer);
  });
});
