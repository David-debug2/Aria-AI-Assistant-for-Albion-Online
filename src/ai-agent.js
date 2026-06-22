require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadBrainContext } = require('./brain-loader');

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;

// 2026 Production-Ready Tiers
const GEMINI_FLASH = 'gemini-3.5-flash';
const GEMINI_PRO   = 'gemini-3.1-pro-preview';

const OLLAMA_INTENTS = new Set(['summarize', 'format', 'list']);
const GEMINI_PRO_INTENTS = new Set(['build', 'pvp', 'guild', 'strategy']);

const SYSTEM_PROMPT = `You are an expert Albion Online strategist, economist, and guide writer.
You have been given a knowledge base about the game. Always prioritize information from that knowledge base.
When live market data is included, analyze it concretely: give specific item names, exact silver values, and ranked recommendations.
Be direct and specific. Avoid vague advice. Format your response in clean Markdown.`;

/**
 * Main entry point. Accepts a query + optional live data and returns an AI response.
 *
 * @param {string} query - The user's question
 * @param {object|null} liveData - Optional live market/price data to inject
 * @param {string|null} forceIntent - Override intent detection
 * @param {{provider: string, model: string, apiKey: string}|null} aiOptions - User supplied provider config
 * @returns {Promise<{ response: string, engine: string, intent: string, filesLoaded: string[] }>}
 */

async function ask(query, liveData = null, forceIntent = null, aiOptions = null) {
  const { context, intent, filesLoaded } = loadBrainContext(query, forceIntent);

  const liveSection = liveData
    ? `\n\n### LIVE MARKET DATA ###\n\`\`\`json\n${JSON.stringify(liveData, null, 2)}\n\`\`\``
    : '';

  // Clean separation: User message only contains context data and the direct question
  const userMessage = `${context}${liveSection}\n\n---\n\nPLAYER QUESTION:\n${query}`;

  if (aiOptions) {
    const response = await askProvider(userMessage, aiOptions);
    return {
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

    response = await askOllama(userMessage, ollamaModel);
    
    if (!response) {
      response = await askGemini(userMessage, GEMINI_FLASH);
      return { response, engine: 'gemini-flash (ollama fallback)', intent, filesLoaded };
    }
  } else if (engine === 'gemini-pro') {
    response = await askGemini(userMessage, GEMINI_PRO);
  } else {
    response = await askGemini(userMessage, GEMINI_FLASH);
  }

  return { response, engine, intent, filesLoaded };
}

function chooseEngine(intent, prompt) {
  if (OLLAMA_INTENTS.has(intent)) return 'ollama';
  if (GEMINI_PRO_INTENTS.has(intent)) return 'gemini-pro';
  
  // Confidently let Gemini handle larger data blocks instead of bottlenecking Ollama
  return 'gemini-flash'; 
}

async function askGemini(prompt, model = GEMINI_FLASH) {
  if (!genAI) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  // Passing systemInstruction cleanly into the model instance configuration
  const geminiModel = genAI.getGenerativeModel({ 
    model,
    systemInstruction: SYSTEM_PROMPT 
  });
  
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

async function askProvider(prompt, { provider, model, apiKey }) {
  if (provider === 'openrouter') return askOpenRouter(prompt, model, apiKey);
  if (provider === 'openai') return askOpenAI(prompt, model, apiKey);
  if (provider === 'anthropic') return askAnthropic(prompt, model, apiKey);
  if (provider === 'gemini') return askGeminiWithKey(prompt, model, apiKey);

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

async function askOpenRouter(prompt, model, apiKey) {
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
      ]
    }
  });

  return data?.choices?.[0]?.message?.content || '';
}

async function askOpenAI(prompt, model, apiKey) {
  const data = await postJson('https://api.openai.com/v1/chat/completions', {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    }
  });

  return data?.choices?.[0]?.message?.content || '';
}

async function askAnthropic(prompt, model, apiKey) {
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

  return (data?.content || [])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

async function askGeminiWithKey(prompt, model, apiKey) {
  const userGenAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = userGenAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT
  });

  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
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

module.exports = {
  ask,
  askProvider,
  askOpenRouter,
  askOpenAI,
  askAnthropic,
  askGeminiWithKey
};
