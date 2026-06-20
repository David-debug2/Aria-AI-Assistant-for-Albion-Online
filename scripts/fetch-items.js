// scripts/fetch-items.js
// Run with: node scripts/fetch-items.js

const fs = require('fs');
const path = require('path');

// NOTE: If this archived repo lacks recent items, switch to a live community fork
const SOURCE_URL =
  'https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json';

async function fetchItems() {
  console.log('Downloading Albion item list...');

  try {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();

    const items = raw
      .filter(item => item.UniqueName && item.LocalizedNames?.['EN-US'])
      .map(item => ({
        id: item.UniqueName,
        name: item.LocalizedNames['EN-US'],
        searchText: buildSearchText(item),
      }));

    const outPath = path.join(__dirname, '../data/albion-items.json');
    
    // Fix 1: Ensure target directory exists before writing
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
    console.log(`Saved ${items.length} items to data/albion-items.json`);
  } catch (err) {
    console.error('Error during execution:', err.message);
    process.exit(1);
  }
}

function buildSearchText(item) {
  const name = item.LocalizedNames['EN-US'] || '';
  const id = item.UniqueName || '';

  const tierMatch = id.match(/^T(\d)/);
  const enchantMatch = id.match(/@(\d)$/);

  const tNum = tierMatch ? tierMatch[1] : '';
  const eNum = enchantMatch ? enchantMatch[1] : '0'; // Fallback to '0' for flat items

  const tierText = tNum ? `tier ${tNum} t${tNum}` : '';
  const enchantText = enchantMatch ? `.${eNum} enchant ${eNum}` : 'flat .0';
  
  // Fix 2: Create composite shorthand tags that mirror actual player search behavior
  const playerShorthand = tNum ? `t${tNum}.${eNum} ${tNum}.${eNum}` : '';

  return `${name} ${tierText} ${enchantText} ${playerShorthand} ${id}`.toLowerCase().trim();
}

fetchItems();