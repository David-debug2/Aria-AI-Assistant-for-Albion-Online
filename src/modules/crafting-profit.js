// src/modules/crafting-profit.js
// Calculates crafting profit/loss for items considering ingredients, taxes, and market prices.

const { resolveItem } = require('../item-resolver');
const { getPrices } = require('../market-api');

// Simplified crafting recipes (ingredient requirements by item ID patterns)
// In production, this would come from a comprehensive recipe database
const CRAFTING_RECIPES = {
  'T4_MAIN_SWORD': {
    ingredients: [{ id: 'T4_ORE', quantity: 50 }],
    craftingTime: 300,
    tax: 0.08,
  },
  'T5_MAIN_SWORD': {
    ingredients: [{ id: 'T5_ORE', quantity: 50 }],
    craftingTime: 600,
    tax: 0.09,
  },
  'T6_MAIN_SWORD': {
    ingredients: [{ id: 'T6_ORE', quantity: 50 }],
    craftingTime: 900,
    tax: 0.10,
  },
  'T4_HEAD_HELMET': {
    ingredients: [{ id: 'T4_ORE', quantity: 30 }, { id: 'T4_LEATHER', quantity: 10 }],
    craftingTime: 400,
    tax: 0.08,
  },
  'T5_HEAD_HELMET': {
    ingredients: [{ id: 'T5_ORE', quantity: 30 }, { id: 'T5_LEATHER', quantity: 10 }],
    craftingTime: 800,
    tax: 0.09,
  },
  'T6_HEAD_HELMET': {
    ingredients: [{ id: 'T6_ORE', quantity: 30 }, { id: 'T6_LEATHER', quantity: 10 }],
    craftingTime: 1200,
    tax: 0.10,
  },
};

/**
 * Calculate profit/loss for crafting an item.
 *
 * @param {string} itemQuery - Item name or ID (e.g. "T5 sword" or "T5_MAIN_SWORD")
 * @param {object} options - { server: 'west', location: 'Caerleon', enchantmentLevel: 0 }
 * @returns {object} - { success, profit, breakdown, error }
 */
async function calculateCraftingProfit(itemQuery, options = {}) {
  const { server = 'west', location = 'Caerleon', enchantmentLevel = 0 } = options;

  try {
    // Step 1: Resolve item to ID
    const resolved = resolveItem(itemQuery);
    if (!resolved) {
      return {
        success: false,
        error: `Could not find item: "${itemQuery}"`,
      };
    }

    const itemId = resolved.id;
    const itemName = resolved.name;

    // Step 2: Check if recipe exists
    const recipe = CRAFTING_RECIPES[itemId];
    if (!recipe) {
      return {
        success: false,
        error: `No crafting recipe found for "${itemName}" (${itemId}). This item may not be craftable or is not yet in the database.`,
      };
    }

    // Step 3: Fetch ingredient prices
    const ingredientIds = recipe.ingredients.map(ing => ing.id);
    const priceResult = await getPrices(ingredientIds, server, [location]);

    if (priceResult.error) {
      return {
        success: false,
        error: `Failed to fetch ingredient prices: ${priceResult.error}`,
      };
    }

    // Step 4: Calculate ingredient cost
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

      const ingredientPrice = priceEntry.sell_price_min; // Buy at lowest sell
      const totalIngredientCost = ingredientPrice * ingredient.quantity;
      ingredientCost += totalIngredientCost;

      ingredientBreakdown.push({
        id: ingredient.id,
        name: priceEntry.item_id,
        quantity: ingredient.quantity,
        unitPrice: ingredientPrice,
        total: totalIngredientCost,
      });
    }

    // Step 5: Fetch output item price
    const outputPrice = await getPrices([itemId], server, [location]);
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

    // Step 6: Calculate taxes and profit
    const craftingTax = ingredientCost * recipe.tax;
    const totalCost = ingredientCost + craftingTax;

    // Enchantment cost (rough estimate)
    let enchantmentCost = 0;
    if (enchantmentLevel > 0) {
      // @1: 50k, @2: 500k, @3: 5000k (essences)
      const enchantmentCosts = [0, 50000, 500000, 5000000];
      enchantmentCost = enchantmentCosts[Math.min(enchantmentLevel, 3)] || 0;
    }

    const grossProfit = sellPrice - totalCost - enchantmentCost;
    const profitMargin = (grossProfit / totalCost * 100).toFixed(2);
    const profitsPerHour = Math.floor((grossProfit / (recipe.craftingTime / 3600)) / 1000) * 1000; // Rounded

    return {
      success: true,
      item: itemName,
      itemId,
      profit: Math.floor(grossProfit),
      profitMargin: `${profitMargin}%`,
      profitsPerHour,
      breakdown: {
        ingredientCost: Math.floor(ingredientCost),
        craftingTax: Math.floor(craftingTax),
        enchantmentCost: Math.floor(enchantmentCost),
        totalCost: Math.floor(totalCost),
        sellPrice: Math.floor(sellPrice),
        ingredients: ingredientBreakdown,
      },
      recommendation:
        grossProfit > 100000
          ? '✅ Good profit opportunity!'
          : grossProfit > 0
          ? '⚠️ Marginal profit, risky'
          : '❌ Loss-making, avoid',
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

/**
 * Analyze multiple items and rank by profitability.
 *
 * @param {string[]} itemQueries - List of item names
 * @param {object} options - { server, location }
 * @returns {object} - { items: [...], topThree: [...], error }
 */
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

  // Sort by profit (highest first)
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
};
