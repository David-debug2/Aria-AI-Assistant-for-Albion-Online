const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { app, validateAiHeaders } = require('../src/server');

function request(server, { method = 'GET', path = '/', headers = {}, body = null }) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        method,
        path,
        headers
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null
          });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

test('AI provider header validation', async (t) => {
  await t.test('accepts supported provider and model', () => {
    const result = validateAiHeaders({
      'x-provider': 'OpenRouter',
      'x-model': 'openai/gpt-4o-mini',
      'x-provider-key': 'test-key'
    });

    assert.deepStrictEqual(result.value, {
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      apiKey: 'test-key'
    });
  });

  await t.test('rejects unsupported provider', () => {
    const result = validateAiHeaders({
      'x-provider': 'unknown',
      'x-model': 'openai/gpt-4o-mini',
      'x-provider-key': 'test-key'
    });

    assert.strictEqual(result.error, 'Unsupported AI provider.');
  });

  await t.test('rejects unsupported model for provider', () => {
    const result = validateAiHeaders({
      'x-provider': 'openai',
      'x-model': 'claude-3-5-haiku-latest',
      'x-provider-key': 'test-key'
    });

    assert.strictEqual(result.error, 'Unsupported AI model for selected provider.');
  });
});

test('/api/ask rejects missing and unsupported provider config', async (t) => {
  const server = app.listen(0, '127.0.0.1');

  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  await t.test('missing provider headers returns 400', async () => {
    const response = await request(server, {
      method: 'POST',
      path: '/api/ask',
      headers: { 'Content-Type': 'application/json' },
      body: { query: 'best T5 PvP build' }
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.body.error, 'Provider, model, and API key are required.');
  });

  await t.test('unsupported model returns 400', async () => {
    const response = await request(server, {
      method: 'POST',
      path: '/api/ask',
      headers: {
        'Content-Type': 'application/json',
        'X-Provider': 'openrouter',
        'X-Model': 'not-a-real-model',
        'X-Provider-Key': 'test-key'
      },
      body: { query: 'best T5 PvP build' }
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.body.error, 'Unsupported AI model for selected provider.');
  });
});
