require('dotenv').config({ quiet: true });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAICacheManager } = require('@google/generative-ai/server');
const { loadBrainContext } = require('./brain-loader');
const {
  getResponseSchema,
  getResponseTypeForIntent,
  validateResponse,
} = require('./schemas');

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;

// 2026 Production-Ready Tiers
const GEMINI_FLASH = 'gemini-3.5-flash';
const GEMINI_PRO   = 'gemini-3.1-pro-preview';

const OLLAMA_INTENTS = new Set(['summarize', 'format', 'list']);
const GEMINI_PRO_INTENTS = new Set(['build', 'pvp', 'guild', 'strategy']);

const providerRuntime = {
  askOllama: (...args) => askOllama(...args),
  askGemini: (...args) => askGemini(...args),
};

const SYSTEM_PROMPT = `You are an expert Albion Online strategist, economist, and guide writer.
You have been given a knowledge base about the game. Always prioritize information from that knowledge base.
When live market data is included, analyze it concretely: give specific item names, exact silver values, and ranked recommendations.
Be direct and specific. Avoid vague advice.
Return only valid JSON matching the response schema. Do not wrap JSON in Markdown fences.`;

const STATIC_REFERENCE_CONTEXT = `Static Albion reference tables:

Crafting tax rates by simplified recipe tier:
- T4 sword/helmet: 8%
- T5 sword/helmet: 9%
- T6 sword/helmet: 10%

Enchantment cost estimates:
- .0: 0 silver
- .1: 50,000 silver
- .2: 500,000 silver
- .3: 5,000,000 silver

Territory tax and requirement references:
- Residential territory: 5% tax, 50,000-100,000 weekly income, 15 minimum members, 100,000 minimum treasury
- Industrial territory: 10% tax, 100,000-200,000 weekly income, 25 minimum members, 500,000 minimum treasury
- Commercial territory: 15% tax, 150,000-300,000 weekly income, 40 minimum members, 2,000,000 minimum treasury

ZvZ preparation cost estimates:
- Small scale: about 350,000 silver
- Medium scale: about 900,000 silver
- Large scale: about 2,800,000 silver`;

const GEMINI_CACHE_TTL_SECONDS = Number(process.env.GEMINI_CACHE_TTL_SECONDS || 3600);
const GEMINI_CACHE_REFRESH_BUFFER_MS = 60 * 1000;
const geminiCacheManager = process.env.GOOGLE_API_KEY ? new GoogleAICacheManager(process.env.GOOGLE_API_KEY) : null;
const geminiStaticCaches = new Map();

class MalformedModelOutputError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'MalformedModelOutputError';
    this.details = details;
  }
}

/**
 * Main entry point. Accepts a query + optional live data and returns an AI response.
 *
 * @param {string} query - The user's question
 * @param {object|null} liveData - Optional live market/price data to inject
 * @param {string|null} forceIntent - Override intent detection
 * @param {{provider: string, model: string, apiKey: string}|null} aiOptions - User supplied provider config
 * @returns {Promise<{ responseType: string, response: object, engine: string, intent: string, filesLoaded: string[] }>}
 */

async function ask(query, liveData = null, forceIntent = null, aiOptions = null) {
  const { context, intent, filesLoaded } = await loadBrainContext(query, forceIntent);
  const responseType = getResponseTypeForIntent(intent);

  const liveSection = liveData
    ? `\n\n### LIVE MARKET DATA ###\n\`\`\`json\n${JSON.stringify(liveData, null, 2)}\n\`\`\``
    : '';

  // Clean separation: User message only contains context data and the direct question
  const userMessage = `${context}${liveSection}\n\n---\n\nPLAYER QUESTION:\n${query}${getResponseInstructions(responseType)}`;

  if (aiOptions) {
    const response = await askProvider(userMessage, aiOptions, responseType);
    return {
      responseType,
      response,
      engine: `${aiOptions.provider}:${aiOptions.model}`,
      intent,
      filesLoaded
    };
  }

  const engine = chooseEngine(intent, userMessage);

  let response;
  if (engine === 'ollama') {
    // Map directly to your active local local tags
    const ollamaModel = OLLAMA_INTENTS.has(intent)
      ? 'qwen3.6'          // highly optimized for fast structured text
      : 'deepseek-v4-pro'; // deep reasoning fallback if offline

    response = await providerRuntime.askOllama(userMessage, ollamaModel);
    
    if (!response) {
      response = await providerRuntime.askGemini(userMessage, GEMINI_FLASH, responseType);
      return { responseType, response, engine: 'gemini-flash (ollama fallback)', intent, filesLoaded };
    }

    response = parseAndValidateModelJson(response, responseType);
  } else if (engine === 'gemini-pro') {
    response = await providerRuntime.askGemini(userMessage, GEMINI_PRO, responseType);
  } else {
    response = await providerRuntime.askGemini(userMessage, GEMINI_FLASH, responseType);
  }

  return { responseType, response, engine, intent, filesLoaded };
}

function chooseEngine(intent, prompt) {
  if (OLLAMA_INTENTS.has(intent)) return 'ollama';
  if (GEMINI_PRO_INTENTS.has(intent)) return 'gemini-pro';
  
  // Confidently let Gemini handle larger data blocks instead of bottlenecking Ollama
  return 'gemini-flash'; 
}

function getResponseInstructions(responseType) {
  return `\n\nReturn JSON for responseType "${responseType}". All required fields must be present. Use empty arrays when there are no items.`;
}

function parseAndValidateModelJson(text, responseType) {
  let jsonText = String(text || '').trim();
  const fenced = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) jsonText = fenced[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new MalformedModelOutputError('Model returned malformed JSON', [err.message]);
  }

  const validation = validateResponse(responseType, parsed);
  if (!validation.valid) {
    throw new MalformedModelOutputError('Model JSON did not match the expected response schema', validation.errors);
  }

  return parsed;
}

function isCacheExpiredOrNearExpiry(cachedContent) {
  if (!cachedContent?.expireTime) return false;
  const expireTime = Date.parse(cachedContent.expireTime);
  return Number.isFinite(expireTime) && expireTime <= Date.now() + GEMINI_CACHE_REFRESH_BUFFER_MS;
}

function isCacheError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return (
    message.includes('cachedcontent') ||
    message.includes('cached content') ||
    message.includes('cache') ||
    message.includes('expired') ||
    message.includes('not found')
  );
}

async function createGeminiStaticCache(model) {
  if (!geminiCacheManager) return null;

  const cachedContent = await geminiCacheManager.create({
    model,
    displayName: `aria-static-context-${model}`,
    systemInstruction: SYSTEM_PROMPT,
    contents: [
      {
        role: 'user',
        parts: [{ text: STATIC_REFERENCE_CONTEXT }],
      },
    ],
    ttlSeconds: GEMINI_CACHE_TTL_SECONDS,
  });

  console.log(`Gemini static context cache ready: ${cachedContent.name} (${model})`);
  return cachedContent;
}

async function loadConfiguredGeminiStaticCache(model) {
  const configuredName = process.env.GEMINI_STATIC_CACHE_NAME;
  if (!geminiCacheManager || !configuredName) return null;

  const cachedContent = await geminiCacheManager.get(configuredName);
  const cachedModel = String(cachedContent.model || '').replace(/^models\//, '');
  if (cachedModel && cachedModel !== model) return null;
  return cachedContent;
}

function startGeminiStaticCache(model, forceRefresh = false) {
  if (!geminiCacheManager) return Promise.resolve(null);

  const existing = geminiStaticCaches.get(model);
  if (existing && !forceRefresh) return existing.promise;

  const promise = (async () => {
    try {
      const configuredCache = forceRefresh ? null : await loadConfiguredGeminiStaticCache(model);
      const cachedContent = configuredCache || await createGeminiStaticCache(model);
      geminiStaticCaches.set(model, { cachedContent, promise: Promise.resolve(cachedContent) });
      return cachedContent;
    } catch (err) {
      geminiStaticCaches.delete(model);
      console.warn(`Gemini static context cache unavailable for ${model}:`, err.message);
      return null;
    }
  })();

  geminiStaticCaches.set(model, { cachedContent: null, promise });
  return promise;
}

async function getGeminiStaticCache(model) {
  const cached = await startGeminiStaticCache(model);
  if (!cached || isCacheExpiredOrNearExpiry(cached)) {
    return startGeminiStaticCache(model, true);
  }
  return cached;
}

function getUncachedGeminiModel(model, responseType) {
  return genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getResponseSchema(responseType),
    },
  });
}

async function getCachedGeminiModel(model, responseType) {
  const cachedContent = await getGeminiStaticCache(model);
  if (!cachedContent) return getUncachedGeminiModel(model, responseType);

  return genAI.getGenerativeModelFromCachedContent(cachedContent, {
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getResponseSchema(responseType),
    },
  });
}

function logGeminiUsageMetadata(result, model) {
  const usageMetadata = result?.response?.usageMetadata;
  if (!usageMetadata) return;

  console.log('Gemini usageMetadata:', JSON.stringify({
    model,
    promptTokenCount: usageMetadata.promptTokenCount,
    candidatesTokenCount: usageMetadata.candidatesTokenCount,
    totalTokenCount: usageMetadata.totalTokenCount,
    cachedContentTokenCount: usageMetadata.cachedContentTokenCount || 0,
  }));
}

async function askGemini(prompt, model = GEMINI_FLASH, responseType = 'chatAnswer') {
  if (!genAI) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  let geminiModel = await getCachedGeminiModel(model, responseType);
  let result;
  try {
    result = await geminiModel.generateContent(prompt);
  } catch (err) {
    if (!isCacheError(err)) throw err;

    console.warn(`Gemini static context cache failed for ${model}; refreshing and retrying:`, err.message);
    geminiStaticCaches.delete(model);
    geminiModel = await getCachedGeminiModel(model, responseType);
    result = await geminiModel.generateContent(prompt);
  }

  logGeminiUsageMetadata(result, model);
  return parseAndValidateModelJson(result.response.text(), responseType);
}

async function askProvider(prompt, { provider, model, apiKey }, responseType = 'chatAnswer') {
  if (provider === 'openrouter') return askOpenRouter(prompt, model, apiKey, responseType);
  if (provider === 'openai') return askOpenAI(prompt, model, apiKey, responseType);
  if (provider === 'anthropic') return askAnthropic(prompt, model, apiKey, responseType);
  if (provider === 'gemini') return askGeminiWithKey(prompt, model, apiKey, responseType);

  throw new Error('Unsupported AI provider');
}

async function getFetch() {
  if (globalThis.fetch) return globalThis.fetch.bind(globalThis);
  const { default: fetch } = await import('node-fetch');
  return fetch;
}

async function postJson(url, { headers, body }) {
  const fetch = await getFetch();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { error: { message: text } };
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Provider request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function askOpenRouter(prompt, model, apiKey, responseType = 'chatAnswer') {
  const data = await postJson('https://openrouter.ai/api/v1/chat/completions', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Aria Albion Strategy AI'
    },
    body: {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    }
  });

  return parseAndValidateModelJson(data?.choices?.[0]?.message?.content || '', responseType);
}

async function askOpenAI(prompt, model, apiKey, responseType = 'chatAnswer') {
  const data = await postJson('https://api.openai.com/v1/chat/completions', {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    }
  });

  return parseAndValidateModelJson(data?.choices?.[0]?.message?.content || '', responseType);
}

async function askAnthropic(prompt, model, apiKey, responseType = 'chatAnswer') {
  const data = await postJson('https://api.anthropic.com/v1/messages', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    }
  });

  const content = (data?.content || [])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  return parseAndValidateModelJson(content, responseType);
}

async function askGeminiWithKey(prompt, model, apiKey, responseType = 'chatAnswer') {
  const userGenAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = userGenAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getResponseSchema(responseType),
    },
  });

  const result = await geminiModel.generateContent(prompt);
  return parseAndValidateModelJson(result.response.text(), responseType);
}

async function askOllama(prompt, modelOverride = null) {
  try {
    const { default: ollama } = await import('ollama');
    const model = modelOverride || process.env.OLLAMA_MODEL || 'qwen3.6';

    // Injecting system context cleanly into the messages array layout
    const res = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
    });
    return res.message.content;
  } catch (err) {
    console.warn('Ollama unavailable:', err.message);
    return null;
  }
}

if (geminiCacheManager) {
  for (const model of new Set([GEMINI_FLASH, GEMINI_PRO])) {
    startGeminiStaticCache(model);
  }
}

module.exports = {
  ask,
  askProvider,
  askOpenRouter,
  askOpenAI,
  askAnthropic,
  askGeminiWithKey,
  MalformedModelOutputError,
  parseAndValidateModelJson,
  __setTestProviders(overrides = {}) {
    if (overrides.askOllama) providerRuntime.askOllama = overrides.askOllama;
    if (overrides.askGemini) providerRuntime.askGemini = overrides.askGemini;
    return () => {
      providerRuntime.askOllama = (...args) => askOllama(...args);
      providerRuntime.askGemini = (...args) => askGemini(...args);
    };
  }
};
