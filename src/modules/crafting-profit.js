// Calculates crafting profit/loss for items considering ingredients, taxes, and market prices.

const fs = require('fs');
const path = require('path');
const { resolveItem } = require('../item-resolver');
const marketApi = require('../market-api');
const { calculateMargin, formatMarginPercent, roundCurrency } = require('./calc-helpers');

const FALLBACK_RECIPES = {
  T4_MAIN_SWORD: {
    ingredients: [{ id: 'T4_ORE', quantity: 50 }],
    craftingTime: 300,
    tax: 0.08,
  },
  T5_MAIN_SWORD: {
    ingredients: [{ id: 'T5_ORE', quantity: 50 }],
    craftingTime: 600,
    tax: 0.09,
  },
  T6_MAIN_SWORD: {
    ingredients: [{ id: 'T6_ORE', quantity: 50 }],
    craftingTime: 900,
    tax: 0.10,
  },
  T4_HEAD_HELMET: {
    ingredients: [{ id: 'T4_ORE', quantity: 30 }, { id: 'T4_LEATHER', quantity: 10 }],
    craftingTime: 400,
    tax: 0.08,
  },
  T5_HEAD_HELMET: {
    ingredients: [{ id: 'T5_ORE', quantity: 30 }, { id: 'T5_LEATHER', quantity: 10 }],
    craftingTime: 800,
    tax: 0.09,
  },
  T6_HEAD_HELMET: {
    ingredients: [{ id: 'T6_ORE', quantity: 30 }, { id: 'T6_LEATHER', quantity: 10 }],
    craftingTime: 1200,
    tax: 0.10,
  },
};

const DATA_DIR = process.env.ARIA_DATA_DIR || path.join(__dirname, '../../data');
const FETCH_HINT = 'Run: npm run fetch-openalbion';

let recipeCache = null;
let testRecipeSources = null;
let priceProvider = (...args) => marketApi.getPrices(...args);

function taxRateForTier(tier) {
  const tierNumber = Number(String(tier || '').match(/\d+/)?.[0] || 4);
  if (tierNumber <= 4) return 0.08;
  if (tierNumber === 5) return 0.09;
  return 0.10;
}

function readGeneratedJson(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`Crafting data file missing: ${filename}. ${FETCH_HINT}`);
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeOpenAlbionRecipe(recipe) {
  if (!recipe?.identifier || !Array.isArray(recipe.requirements)) return null;

  const ingredients = recipe.requirements
    .map(requirement => ({
      id: requirement.identifier,
      quantity: Number(requirement.value || 0),
    }))
    .filter(ingredient => ingredient.id && ingredient.quantity > 0);

  if (ingredients.length === 0) return null;

  return {
    ingredients,
    craftingTime: Number(recipe.craftingTime || recipe.crafting_time || 300),
    tax: taxRateForTier(recipe.tier),
    silverFee: 0,
    source: 'openalbion-consumable',
  };
}

function normalizeGameinfoRecipe(recipe) {
  if (!recipe?.identifier || !Array.isArray(recipe.ingredients)) return null;

  const ingredients = recipe.ingredients
    .map(ingredient => ({
      id: ingredient.uniqueName || ingredient.id,
      quantity: Number(ingredient.count || ingredient.quantity || 0),
    }))
    .filter(ingredient => ingredient.id && ingredient.quantity > 0);

  if (ingredients.length === 0) return null;

  return {
    ingredients,
    craftingTime: Number(recipe.craftingTime || 300),
    tax: taxRateForTier(recipe.tier || recipe.identifier),
    silverFee: Number(recipe.silverCost || recipe.silverFee || 0),
    source: 'gameinfo',
  };
}

function loadRecipeMap() {
  if (recipeCache) return recipeCache;

  const recipes = new Map(Object.entries(FALLBACK_RECIPES).map(([id, recipe]) => [
    id,
    { ...recipe, silverFee: 0, source: 'fallback' },
  ]));

  const consumableRecipes = testRecipeSources?.consumables
    || readGeneratedJson('openalbion-consumable-recipes.json', []);
  for (const recipe of Array.isArray(consumableRecipes) ? consumableRecipes : []) {
    const normalized = normalizeOpenAlbionRecipe(recipe);
    if (normalized) recipes.set(recipe.identifier, normalized);
  }

  const gearRecipes = testRecipeSources?.gear
    || readGeneratedJson('gameinfo-gear-recipes.json', []);
  for (const recipe of Array.isArray(gearRecipes) ? gearRecipes : []) {
    const normalized = normalizeGameinfoRecipe(recipe);
    if (normalized) recipes.set(recipe.identifier, normalized);
  }

  recipeCache = recipes;
  return recipeCache;
}

async function calculateCraftingProfit(itemQuery, options = {}) {
  const { server = 'west', location = 'Caerleon', enchantmentLevel = 0 } = options;

  try {
    const resolved = resolveItem(itemQuery);
    if (!resolved) {
      return {
        success: false,
        error: `Could not find item: "${itemQuery}"`,
      };
    }

    const itemId = resolved.id;
    const itemName = resolved.name;
    const recipe = loadRecipeMap().get(itemId);
    if (!recipe) {
      return {
        success: false,
        error: `No crafting recipe found for "${itemName}" (${itemId}). This item may not be craftable or is not yet in the database.`,
      };
    }

    const ingredientIds = recipe.ingredients.map(ing => ing.id);
    const priceResult = await priceProvider(ingredientIds, server, [location]);
    if (priceResult.error) {
      return {
        success: false,
        error: `Failed to fetch ingredient prices: ${priceResult.error}`,
      };
    }

    let ingredientCost = 0;
    const ingredientBreakdown = [];

    for (const ingredient of recipe.ingredients) {
      const priceEntry = priceResult.data.find(p => p.item_id === ingredient.id);
      if (!priceEntry || priceEntry.sell_price_min === 0) {
        return {
          success: false,
          error: `No price data for ingredient "${ingredient.id}". Check market availability.`,
        };
      }

      const ingredientPrice = priceEntry.sell_price_min;
      const totalIngredientCost = ingredientPrice * ingredient.quantity;
      ingredientCost += totalIngredientCost;

      ingredientBreakdown.push({
        id: ingredient.id,
        name: priceEntry.name || priceEntry.item_id,
        quantity: ingredient.quantity,
        unitPrice: ingredientPrice,
        total: totalIngredientCost,
      });
    }

    const outputPrice = await priceProvider([itemId], server, [location]);
    if (outputPrice.error || outputPrice.data.length === 0) {
      return {
        success: false,
        error: `Could not fetch sell price for "${itemName}"`,
      };
    }

    const sellPrice = outputPrice.data[0].buy_price_max || 0;
    if (sellPrice === 0) {
      return {
        success: false,
        error: `No buyers for "${itemName}" on market. Cannot estimate profit.`,
      };
    }

    let enchantmentCost = 0;
    if (enchantmentLevel > 0) {
      const enchantmentCosts = [0, 50000, 500000, 5000000];
      enchantmentCost = enchantmentCosts[Math.min(enchantmentLevel, 3)] || 0;
    }

    const silverFee = Number(recipe.silverFee || 0);
    const margin = calculateMargin({
      cost: ingredientCost,
      revenue: sellPrice,
      taxRate: recipe.tax,
      taxBase: 'cost',
      extraCost: silverFee + enchantmentCost,
    });
    const totalCost = ingredientCost + silverFee + margin.tax + enchantmentCost;
    const profit = sellPrice - totalCost;
    const profitMargin = totalCost === 0 ? 0 : (profit / totalCost) * 100;
    const craftingTime = Number(recipe.craftingTime || 300);
    const profitsPerHour = Math.floor((profit / (craftingTime / 3600)) / 1000) * 1000;

    return {
      success: true,
      item: itemName,
      itemId,
      profit: roundCurrency(profit),
      profitMargin: formatMarginPercent(profitMargin),
      profitsPerHour,
      breakdown: {
        ingredientCost: roundCurrency(ingredientCost),
        craftingTax: roundCurrency(margin.tax),
        silverFee: roundCurrency(silverFee),
        enchantmentCost: roundCurrency(enchantmentCost),
        totalCost: roundCurrency(totalCost),
        sellPrice: roundCurrency(sellPrice),
        ingredients: ingredientBreakdown,
      },
      recommendation:
        profit > 100000
          ? 'Good profit opportunity.'
          : profit > 0
          ? 'Marginal profit, risky.'
          : 'Loss-making, avoid.',
      server,
      location,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
    };
  }
}

async function rankByCraftingProfit(itemQueries, options = {}) {
  const results = [];

  for (const query of itemQueries) {
    const result = await calculateCraftingProfit(query, options);
    if (result.success) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    return { success: false, error: 'No craftable items found in list' };
  }

  results.sort((a, b) => b.profit - a.profit);

  return {
    success: true,
    items: results,
    topThree: results.slice(0, 3),
    totalEstimatedProfit: Math.floor(results.reduce((sum, r) => sum + r.profit, 0)),
  };
}

module.exports = {
  calculateCraftingProfit,
  rankByCraftingProfit,
  __setRecipeSourcesForTests(sources) {
    testRecipeSources = sources;
    recipeCache = null;
  },
  __setPriceProviderForTests(provider) {
    priceProvider = provider || ((...args) => marketApi.getPrices(...args));
  },
  __resetForTests() {
    testRecipeSources = null;
    recipeCache = null;
    priceProvider = (...args) => marketApi.getPrices(...args);
  },
};
