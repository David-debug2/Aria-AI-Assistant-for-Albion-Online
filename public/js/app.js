// public/js/app.js - Aria Frontend Application

class AriaApp {
  constructor() {
    this.currentTab = 'chat';
    this.providerModels = {
      openrouter: [
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-haiku',
        'google/gemini-2.0-flash-001',
        'meta-llama/llama-3.1-8b-instruct',
      ],
      openai: ['gpt-4o-mini', 'gpt-4o'],
      anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
      gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    };
    this.init();
  }

  init() {
    this.loadAiSettings();
    this.setupEventListeners();
    this.updateKeyStatus();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = link.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Chat form
    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleChatSubmit();
    });

    // Price form
    document.getElementById('price-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePriceSubmit();
    });

    // Crafting form
    document.getElementById('crafting-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCraftingSubmit();
    });

    // Guild forms
    document.getElementById('territory-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTerritorySubmit();
    });

    document.getElementById('zvz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleZvZSubmit();
    });

    document.getElementById('progression-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleProgressionSubmit();
    });

    document.getElementById('provider-select').addEventListener('change', () => {
      this.populateModelOptions();
      this.saveAiSettings();
    });

    document.getElementById('model-select').addEventListener('change', () => {
      this.saveAiSettings();
    });

    document.getElementById('provider-key-input').addEventListener('input', () => {
      this.saveAiSettings();
    });

    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAiSettings();
      this.updateKeyStatus();
    });

    document.getElementById('clear-settings').addEventListener('click', () => {
      sessionStorage.removeItem('ariaAiSettings');
      this.loadAiSettings();
      this.updateKeyStatus();
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    this.currentTab = tabName;
  }

  async handleChatSubmit() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    const aiSettings = this.getAiSettings();
    if (!aiSettings.apiKey) {
      this.addChatMessage('Configure an AI provider key in Settings before asking Aria. The key is stored only for this browser session.', 'bot');
      this.switchTab('settings');
      return;
    }

    this.addChatMessage(message, 'user');
    input.value = '';

    const status = document.getElementById('chat-status');
    status.textContent = 'Thinking...';

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: this.setAiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query: message }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        this.addChatMessage(`❌ Error: ${data.error}`, 'bot');
      } else {
        this.addChatHtml(this.renderStructuredResponse(data), 'bot');
      }

      status.textContent = '';
    } catch (err) {
      this.addChatMessage(`❌ Connection error: ${err.message}`, 'bot');
      status.textContent = '';
    }
  }

  async handlePriceSubmit() {
    const input = document.getElementById('price-input').value.trim();
    const server = document.getElementById('server-select').value;
    const results = document.getElementById('price-results');

    if (!input) {
      results.innerHTML = '<p class="status-danger">Please enter an item name</p>';
      return;
    }

    results.innerHTML = '<p>Fetching prices...</p>';

    try {
      const response = await fetch(
        `/api/price/${encodeURIComponent(input)}?server=${server}`,
        { method: 'GET' }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (data.error) {
        results.innerHTML = `<p class="status-danger">❌ ${data.error}</p>`;
      } else if (data.data && data.data.length > 0) {
        let html = '<table class="data-table"><thead><tr><th>Item</th><th>Buy Price</th><th>Sell Price</th><th>Spread</th></tr></thead><tbody>';

        data.data.forEach(item => {
          const spread = item.buy_price_max > 0
            ? Math.round((item.sell_price_min / item.buy_price_max - 1) * 100)
            : 0;

          html += `
            <tr>
              <td>${item.item_id || 'Unknown'}</td>
              <td>${item.buy_price_max.toLocaleString()}</td>
              <td>${item.sell_price_min.toLocaleString()}</td>
              <td class="status-${spread > 10 ? 'success' : spread > 5 ? 'warning' : 'danger'}">
                +${spread}%
              </td>
            </tr>
          `;
        });

        html += '</tbody></table>';
        results.innerHTML = html;
      } else {
        results.innerHTML = '<p class="status-warning">No price data found</p>';
      }
    } catch (err) {
      results.innerHTML = `<p class="status-danger">❌ ${err.message}</p>`;
    }
  }

  async handleCraftingSubmit() {
    const item = document.getElementById('crafting-input').value.trim();
    const enchantment = document.getElementById('enchantment-select').value;
    const results = document.getElementById('crafting-results');

    if (!item) {
      results.innerHTML = '<p class="status-danger">Please enter an item name</p>';
      return;
    }

    results.innerHTML = '<p>Calculating profit...</p>';

    try {
      const response = await fetch('/api/crafting-profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item,
          enchantmentLevel: parseInt(enchantment),
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (!data.success) {
        results.innerHTML = `<p class="status-danger">❌ ${data.error}</p>`;
      } else {
        const profit = data.profit;
        const statusClass = profit > 100000 ? 'success' : profit > 0 ? 'warning' : 'danger';

        let html = `
          <div class="tool-card">
            <h3>${data.item}</h3>
            <p><strong>Profit:</strong> <span class="status-${statusClass}">${profit.toLocaleString()} silver</span></p>
            <p><strong>Margin:</strong> ${data.profitMargin}</p>
            <p><strong>Per Hour:</strong> ${data.profitsPerHour.toLocaleString()} silver</p>
            <p><strong>Recommendation:</strong> ${data.recommendation}</p>

            <h4 style="margin-top: 15px; color: var(--highlight);">Cost Breakdown:</h4>
            <ul style="list-style: none; margin-top: 10px; font-size: 13px;">
              <li>Ingredients: ${data.breakdown.ingredientCost.toLocaleString()}</li>
              <li>Crafting Tax: ${data.breakdown.craftingTax.toLocaleString()}</li>
              <li>Enchantment: ${data.breakdown.enchantmentCost.toLocaleString()}</li>
              <li><strong>Total Cost:</strong> ${data.breakdown.totalCost.toLocaleString()}</li>
              <li><strong>Sell Price:</strong> ${data.breakdown.sellPrice.toLocaleString()}</li>
            </ul>
          </div>
        `;

        results.innerHTML = html;
      }
    } catch (err) {
      results.innerHTML = `<p class="status-danger">❌ ${err.message}</p>`;
    }
  }

  async handleTerritorySubmit() {
    const members = parseInt(document.getElementById('guild-members').value);
    const treasury = parseInt(document.getElementById('guild-treasury').value);
    const experience = document.getElementById('guild-experience').value;
    const result = document.getElementById('territory-result');

    const strategy = this.simulateTerritoryStrategy(members, treasury, experience);

    result.innerHTML = `
      <h4>${strategy.name}</h4>
      <p><strong>Income:</strong> ${strategy.weeklyIncome}/week</p>
      <p><strong>Defense:</strong> ${strategy.defenseLevel}</p>
      <p><strong>Tax Rate:</strong> ${strategy.taxRate}</p>
      <p><strong>Status:</strong> <span class="status-${strategy.readiness ? 'success' : 'warning'}">
        ${strategy.readiness ? '✅ Ready' : '⚠️ Not Ready Yet'}
      </span></p>
      <p style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
        ${strategy.strategy.join(' • ')}
      </p>
    `;
  }

  async handleZvZSubmit() {
    const scale = document.getElementById('zvz-scale').value;
    const result = document.getElementById('zvz-result');

    const compositions = {
      small: {
        scale: '5v5',
        roles: ['1 Tank', '2 DPS', '1 Healer', '1 CC'],
        cost: '350k',
      },
      medium: {
        scale: '15v15',
        roles: ['3 Tanks', '6 DPS', '3 Healers', '3 CC'],
        cost: '900k',
      },
      large: {
        scale: '40v40',
        roles: ['10 Tanks', '18 DPS', '8 Healers', '4 CC'],
        cost: '2.8m',
      },
    };

    const comp = compositions[scale];

    result.innerHTML = `
      <h4>${comp.scale} Battle Composition</h4>
      <p><strong>Squad Setup:</strong></p>
      <ul style="margin-left: 20px; font-size: 13px;">
        ${comp.roles.map(r => `<li>${r}</li>`).join('')}
      </ul>
      <p style="margin-top: 10px;"><strong>Preparation Cost:</strong> ${comp.cost}</p>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">
        Stock potions, food, and backup gear before engaging.
      </p>
    `;
  }

  async handleProgressionSubmit() {
    const members = parseInt(document.getElementById('prog-members').value);
    const experience = document.getElementById('prog-experience').value;
    const result = document.getElementById('progression-result');

    const roadmap = this.simulateProgressionRoadmap(members, experience);

    result.innerHTML = `
      <h4>${roadmap.stage}</h4>
      <p><strong>Goal:</strong> ${roadmap.goal}</p>
      <p><strong>Timeline:</strong> ${roadmap.timeline}</p>
      <p><strong>Actions:</strong></p>
      <ol style="margin-left: 20px; font-size: 13px;">
        ${roadmap.actions.map(a => `<li>${a}</li>`).join('')}
      </ol>
    `;
  }

  simulateTerritoryStrategy(members, treasury, experience) {
    if (members < 15) {
      return {
        name: 'Not Ready',
        weeklyIncome: 'N/A',
        defenseLevel: 'Too weak',
        taxRate: 'N/A',
        strategy: ['Need at least 15 members', 'Build up treasury to 100k+'],
        readiness: false,
      };
    }

    if (members < 30) {
      return {
        name: 'Residential Territory',
        weeklyIncome: '50-100k',
        defenseLevel: 'Low-Medium',
        taxRate: '5%',
        strategy: ['Good for learning', '15-20 player defense', 'Accept some losses'],
        readiness: treasury >= 100000,
      };
    }

    if (members < 100) {
      return {
        name: 'Industrial Territory',
        weeklyIncome: '100-200k',
        defenseLevel: 'Medium-High',
        taxRate: '10%',
        strategy: ['Requires strong defense', 'Form alliances', 'Higher competition'],
        readiness: treasury >= 500000,
      };
    }

    return {
      name: 'Commercial Territory',
      weeklyIncome: '150-300k',
      defenseLevel: 'Very High',
      taxRate: '15%',
      strategy: ['Mega-guild level', 'Requires alliance', 'Constant warfare'],
      readiness: treasury >= 2000000,
    };
  }

  simulateProgressionRoadmap(members, experience) {
    const roadmaps = [
      {
        stage: 'Solo to Small Guild',
        goal: 'Learn dungeons, stable gameplay',
        timeline: 'Week 1-2',
        actions: ['Recruit 5-10 members', 'Run dungeons 3x/week', 'Build 50-100k treasury', 'Create guild rules'],
      },
      {
        stage: 'Small Guild Phase',
        goal: 'Prepare for territory wars',
        timeline: 'Week 2-4',
        actions: ['Recruit 20-30 players', 'Train 5v5 strategies', 'Build 500k+ war fund', 'Find weak territory'],
      },
      {
        stage: 'Medium Guild',
        goal: 'Hold first territories',
        timeline: 'Week 4-8',
        actions: ['Defend first war', 'Establish defense rotation', 'Recruit specialists', 'Organize squads'],
      },
      {
        stage: 'Growing Guild',
        goal: 'Expand territory control',
        timeline: 'Week 8-16',
        actions: ['Attack industrial territories', 'Manage 2-3 territories', 'Build alliances', 'Upgrade guild hall'],
      },
      {
        stage: 'Established Guild',
        goal: 'Regional dominance',
        timeline: 'Month 4+',
        actions: ['Control 5+ territories', 'Lead alliances', 'Mentor smaller guilds', 'Plan seasonal battles'],
      },
    ];

    if (members < 30) return roadmaps[0];
    if (members < 100) return roadmaps[1];
    if (members < 200) return roadmaps[2];
    if (members < 400) return roadmaps[3];
    return roadmaps[4];
  }

  populateModelOptions(selectedModel = null) {
    const provider = document.getElementById('provider-select').value;
    const modelSelect = document.getElementById('model-select');
    const models = this.providerModels[provider] || [];

    modelSelect.innerHTML = models
      .map(model => `<option value="${model}">${model}</option>`)
      .join('');

    if (selectedModel && models.includes(selectedModel)) {
      modelSelect.value = selectedModel;
    }
  }

  loadAiSettings() {
    const saved = this.getAiSettings();
    const providerSelect = document.getElementById('provider-select');
    const keyInput = document.getElementById('provider-key-input');

    providerSelect.value = saved.provider || 'openrouter';
    this.populateModelOptions(saved.model);
    keyInput.value = saved.apiKey || '';
  }

  saveAiSettings() {
    const provider = document.getElementById('provider-select').value;
    const model = document.getElementById('model-select').value;
    const apiKey = document.getElementById('provider-key-input').value.trim();

    sessionStorage.setItem('ariaAiSettings', JSON.stringify({ provider, model, apiKey }));
    this.updateKeyStatus();
  }

  getAiSettings() {
    try {
      return JSON.parse(sessionStorage.getItem('ariaAiSettings')) || {
        provider: 'openrouter',
        model: this.providerModels.openrouter[0],
        apiKey: '',
      };
    } catch (err) {
      return {
        provider: 'openrouter',
        model: this.providerModels.openrouter[0],
        apiKey: '',
      };
    }
  }

  setAiHeaders(headers) {
    const { provider, model, apiKey } = this.getAiSettings();
    return {
      ...headers,
      'X-Provider': provider,
      'X-Model': model,
      'X-Provider-Key': apiKey,
    };
  }

  updateKeyStatus() {
    const status = document.getElementById('key-status');
    const { provider, model, apiKey } = this.getAiSettings();

    if (!apiKey) {
      status.textContent = 'No key configured';
      status.className = 'key-status status-danger';
      return;
    }

    status.textContent = `Key configured for ${provider} / ${model}`;
    status.className = 'key-status status-success';
  }

  addChatMessage(text, sender) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;

    const senderLabel = sender === 'user' ? 'You' : 'Aria';
    messageDiv.innerHTML = `<strong>${senderLabel}:</strong><p>${this.escapeHtml(text)}</p>`;

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  addChatHtml(html, sender) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;

    const senderLabel = sender === 'user' ? 'You' : 'Aria';
    messageDiv.innerHTML = `<strong>${senderLabel}:</strong>${html}`;

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  renderStructuredResponse(data) {
    if (data.responseType === 'buildRecommendation') {
      return this.renderBuildRecommendation(data);
    }

    if (data.responseType === 'flipRanking') {
      return this.renderFlipRanking(data);
    }

    return this.renderChatAnswer(data);
  }

  renderChatAnswer(data) {
    return `
      <p>${this.escapeHtml(data.answer || data.summary || 'No response')}</p>
      ${this.renderList('Key Points', data.keyPoints)}
      ${this.renderList('Recommendations', data.recommendations)}
      ${this.renderList('Warnings', data.warnings)}
      ${this.renderList('Next Steps', data.nextSteps)}
      ${this.renderResponseMeta(data)}
    `;
  }

  renderBuildRecommendation(data) {
    const build = data.build || {};
    const gear = Array.isArray(build.gearSlots) ? build.gearSlots : [];
    const consumables = Array.isArray(build.consumables) ? build.consumables : [];
    const alternatives = Array.isArray(data.alternatives) ? data.alternatives : [];

    return `
      <p>${this.escapeHtml(data.summary || 'Build recommendation')}</p>
      <h4>${this.escapeHtml([build.role, build.content, build.budget].filter(Boolean).join(' | '))}</h4>
      ${gear.length ? `
        <ul>
          ${gear.map(slot => `<li><strong>${this.escapeHtml(slot.slot)}:</strong> ${this.escapeHtml(slot.item)} - ${this.escapeHtml(slot.reason)}</li>`).join('')}
        </ul>
      ` : ''}
      ${consumables.length ? `
        <h4>Food & Potion</h4>
        <ul>
          ${consumables.map(item => `<li><strong>${this.escapeHtml(item.type)}:</strong> ${this.escapeHtml(item.item)} - ${this.escapeHtml(item.reason)}</li>`).join('')}
        </ul>
      ` : ''}
      ${this.renderList('Rotation', build.rotation)}
      ${this.renderList('Budget Notes', build.budgetNotes)}
      ${alternatives.length ? `
        <h4>Alternatives</h4>
        <ul>
          ${alternatives.map(item => `<li><strong>${this.escapeHtml(item.item)}</strong> for ${this.escapeHtml(item.replaces)} - ${this.escapeHtml(item.reason)}</li>`).join('')}
        </ul>
      ` : ''}
      ${this.renderList('Warnings', data.warnings)}
      ${this.renderResponseMeta(data)}
    `;
  }

  renderFlipRanking(data) {
    const opportunities = Array.isArray(data.opportunities) ? data.opportunities : [];

    return `
      <p>${this.escapeHtml(data.summary || 'Flip ranking')}</p>
      <p><strong>Budget:</strong> ${this.escapeHtml(data.budget || 'Unknown')}</p>
      ${opportunities.length ? `
        <ol>
          ${opportunities.map(item => `
            <li>
              <strong>${this.escapeHtml(item.item)}</strong>:
              buy ${this.escapeHtml(item.buyLocation)} at ${this.formatSilver(item.buyPrice)},
              sell ${this.escapeHtml(item.sellLocation)} at ${this.formatSilver(item.sellPrice)}.
              Profit ${this.formatSilver(item.estimatedProfit)} (${this.escapeHtml(String(item.profitMarginPercent))}%).
              Risk: ${this.escapeHtml(item.transportRisk)}. ${this.escapeHtml(item.notes)}
            </li>
          `).join('')}
        </ol>
      ` : ''}
      ${this.renderList('Warnings', data.warnings)}
      ${this.renderResponseMeta(data)}
    `;
  }

  renderList(title, items) {
    if (!Array.isArray(items) || items.length === 0) return '';

    return `
      <h4>${this.escapeHtml(title)}</h4>
      <ul>
        ${items.map(item => `<li>${this.escapeHtml(String(item))}</li>`).join('')}
      </ul>
    `;
  }

  renderResponseMeta(data) {
    if (!data.engine && !data.intent) return '';
    return `<p><em>Engine: ${this.escapeHtml(data.engine || 'unknown')} | Intent: ${this.escapeHtml(data.intent || 'unknown')}</em></p>`;
  }

  formatSilver(value) {
    if (!Number.isFinite(value)) return 'unknown';
    return `${value.toLocaleString()} silver`;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

function startAriaApp() {
  window.ariaApp = new AriaApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAriaApp);
} else {
  startAriaApp();
}
