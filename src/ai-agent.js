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
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
const CLOUDFLARE_MODEL = process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast';
const OPENROUTER_DAILY_THRESHOLD = Number(process.env.OPENROUTER_DAILY_THRESHOLD || 45);

const OLLAMA_INTENTS = new Set(['summarize', 'format', 'list']);
const GEMINI_PRO_INTENTS = new Set(['build', 'pvp', 'guild', 'strategy']);

const providerRuntime = {
  askOpenRouter: (...args) => askOpenRouter(...args),
  askCloudflare: (...args) => askCloudflare(...args),
  askOllama: (...args) => askOllama(...args),
  askGemini: (...args) => askGemini(...args),
};

const openRouterQuota = {
  day: getLocalDayKey(),
  calls: 0,
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

class ProviderRequestError extends Error {
  constructor(message, status = null, provider = null) {
    super(message);
    this.name = 'ProviderRequestError';
    this.status = status;
    this.provider = provider;
  }
}

class ProviderChainError extends Error {
  constructor(message, failures = []) {
    super(message);
    this.name = 'ProviderChainError';
    this.failures = failures;
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

  const served = await askFallbackChain(userMessage, responseType, intent);

  return { responseType, response: served.response, engine: served.engine, intent, filesLoaded };
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

function getLocalDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function resetOpenRouterQuotaIfNeeded(now = new Date()) {
  const day = getLocalDayKey(now);
  if (openRouterQuota.day !== day) {
    openRouterQuota.day = day;
    openRouterQuota.calls = 0;
  }
}

function isOpenRouterQuotaAvailable() {
  resetOpenRouterQuotaIfNeeded();
  return openRouterQuota.calls < OPENROUTER_DAILY_THRESHOLD;
}

function incrementOpenRouterQuota() {
  resetOpenRouterQuotaIfNeeded();
  openRouterQuota.calls += 1;
}

function isRetryableProviderError(err) {
  if (!err) return false;
  if (!err.status) return true;
  if (err.status === 429) return true;
  if (err.status >= 500 && err.status <= 599) return true;
  return false;
}

function normalizeProviderResponse(textOrObject, responseType) {
  if (textOrObject === null || textOrObject === undefined) return null;
  if (typeof textOrObject === 'string') return parseAndValidateModelJson(textOrObject, responseType);
  return textOrObject;
}

async function askFallbackChain(prompt, responseType, intent) {
  const ollamaModel = OLLAMA_INTENTS.has(intent)
    ? 'qwen3.6'
    : 'deepseek-v4-pro';

  const chain = [
    {
      engine: 'openrouter',
      call: () => providerRuntime.askOpenRouter(prompt, OPENROUTER_MODEL, undefined, responseType),
    },
    {
      engine: 'cloudflare',
      call: () => providerRuntime.askCloudflare(prompt, CLOUDFLARE_MODEL, undefined, undefined, responseType),
    },
    {
      engine: 'ollama',
      call: () => providerRuntime.askOllama(prompt, ollamaModel),
    },
    {
      engine: 'gemini-flash',
      call: () => providerRuntime.askGemini(prompt, GEMINI_FLASH, responseType),
    },
  ];

  const failures = [];
  for (const provider of chain) {
    try {
      const result = await provider.call();
      if (!result) {
        failures.push({ provider: provider.engine, retryable: true, message: 'Provider unavailable' });
        continue;
      }

      return {
        engine: provider.engine,
        response: normalizeProviderResponse(result, responseType),
      };
    } catch (err) {
      if (!isRetryableProviderError(err)) throw err;

      console.warn(`${provider.engine} unavailable; trying next provider:`, err.message);
      failures.push({
        provider: provider.engine,
        status: err.status || null,
        retryable: true,
        message: err.message,
      });
    }
  }

  throw new ProviderChainError('All AI providers are unavailable', failures);
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
  if (provider === 'openrouter') {
    const text = await askOpenRouter(prompt, model, apiKey, responseType);
    if (!text) throw new Error('OpenRouter unavailable');
    return parseAndValidateModelJson(text, responseType);
  }
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
    throw new ProviderRequestError(message, response.status);
  }

  return data;
}

async function askOpenRouter(prompt, model, apiKey, responseType = 'chatAnswer') {
  const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY;
  const resolvedModel = model || OPENROUTER_MODEL;
  const usesEnvQuota = !apiKey;

  if (!resolvedApiKey) return null;
  if (usesEnvQuota && !isOpenRouterQuotaAvailable()) {
    console.warn(`OpenRouter daily local quota threshold reached (${openRouterQuota.calls}/${OPENROUTER_DAILY_THRESHOLD}); skipping provider.`);
    return null;
  }

  if (usesEnvQuota) incrementOpenRouterQuota();

  try {
    const data = await postJson('https://openrouter.ai/api/v1/chat/completions', {
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Aria Albion Strategy AI'
      },
      body: {
        model: resolvedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }
    });

    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    err.provider = 'openrouter';
    if (isRetryableProviderError(err)) {
      console.warn('OpenRouter unavailable:', err.message);
      return null;
    }
    throw err;
  }
}

async function askCloudflare(prompt, model, apiToken, accountId, responseType = 'chatAnswer') {
  const resolvedApiToken = apiToken || process.env.CLOUDFLARE_API_TOKEN;
  const resolvedAccountId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const resolvedModel = model || CLOUDFLARE_MODEL;

  if (!resolvedApiToken || !resolvedAccountId) return null;

  try {
    const data = await postJson(`https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/ai/v1/chat/completions`, {
      headers: {
        Authorization: `Bearer ${resolvedApiToken}`,
      },
      body: {
        model: resolvedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }
    });

    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    err.provider = 'cloudflare';
    if (isRetryableProviderError(err)) {
      console.warn('Cloudflare Workers AI unavailable:', err.message);
      return null;
    }
    throw err;
  }
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
  askFallbackChain,
  askOpenRouter,
  askCloudflare,
  askOpenAI,
  askAnthropic,
  askGeminiWithKey,
  MalformedModelOutputError,
  ProviderRequestError,
  ProviderChainError,
  parseAndValidateModelJson,
  __setTestProviders(overrides = {}) {
    if (overrides.askOpenRouter) providerRuntime.askOpenRouter = overrides.askOpenRouter;
    if (overrides.askCloudflare) providerRuntime.askCloudflare = overrides.askCloudflare;
    if (overrides.askOllama) providerRuntime.askOllama = overrides.askOllama;
    if (overrides.askGemini) providerRuntime.askGemini = overrides.askGemini;
    return () => {
      providerRuntime.askOpenRouter = (...args) => askOpenRouter(...args);
      providerRuntime.askCloudflare = (...args) => askCloudflare(...args);
      providerRuntime.askOllama = (...args) => askOllama(...args);
      providerRuntime.askGemini = (...args) => askGemini(...args);
    };
  },
  __openRouterQuotaForTests: {
    getState() {
      resetOpenRouterQuotaIfNeeded();
      return { ...openRouterQuota, threshold: OPENROUTER_DAILY_THRESHOLD };
    },
    setState({ day = getLocalDayKey(), calls = 0 } = {}) {
      openRouterQuota.day = day;
      openRouterQuota.calls = calls;
    },
    reset() {
      openRouterQuota.day = getLocalDayKey();
      openRouterQuota.calls = 0;
    },
  }
};
