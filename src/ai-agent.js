require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadBrainContext } = require('./brain-loader');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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
 * @returns {Promise<{ response: string, engine: 'gemini-flash'|'gemini-pro'|'ollama'|'gemini-flash (ollama fallback)', intent: string, filesLoaded: string[] }>}
 */

async function ask(query, liveData = null, forceIntent = null) {
  const { context, intent, filesLoaded } = loadBrainContext(query, forceIntent);

  const liveSection = liveData
    ? `\n\n### LIVE MARKET DATA ###\n\`\`\`json\n${JSON.stringify(liveData, null, 2)}\n\`\`\``
    : '';

  // Clean separation: User message only contains context data and the direct question
  const userMessage = `${context}${liveSection}\n\n---\n\nPLAYER QUESTION:\n${query}`;

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
  // Passing systemInstruction cleanly into the model instance configuration
  const geminiModel = genAI.getGenerativeModel({ 
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

module.exports = { ask };