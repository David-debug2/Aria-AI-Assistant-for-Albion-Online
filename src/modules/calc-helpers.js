const DEFAULT_MARKET_TAX_RATE = 0.065;

function roundCurrency(value) {
  return Math.floor(Number(value) || 0);
}

function formatMarginPercent(value) {
  return `${value.toFixed(2)}%`;
}

function calculateMargin({
  cost,
  revenue,
  taxRate = 0,
  taxBase = 'cost',
  extraCost = 0,
}) {
  const numericCost = Number(cost) || 0;
  const numericRevenue = Number(revenue) || 0;
  const numericExtraCost = Number(extraCost) || 0;
  const taxableAmount = taxBase === 'revenue' ? numericRevenue : numericCost;
  const tax = taxableAmount * taxRate;
  const totalCost = numericCost + tax;
  const profit = numericRevenue - totalCost - numericExtraCost;
  const margin = totalCost === 0 ? 0 : (profit / totalCost) * 100;

  return {
    cost: numericCost,
    revenue: numericRevenue,
    tax,
    totalCost,
    extraCost: numericExtraCost,
    profit,
    margin,
  };
}

module.exports = {
  DEFAULT_MARKET_TAX_RATE,
  calculateMargin,
  formatMarginPercent,
  roundCurrency,
};
