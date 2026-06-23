const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');

function request(server, { method = 'GET', path: requestPath = '/', headers = {}, body = null }) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        method,
        path: requestPath,
        headers,
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
            body: responseBody ? JSON.parse(responseBody) : null,
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

test('/api/ask returns 503 for malformed model output', async (t) => {
  const aiAgentPath = path.resolve(__dirname, '..', 'src', 'ai-agent.js');
  class MalformedModelOutputError extends Error {}

  require.cache[aiAgentPath] = {
    id: aiAgentPath,
    filename: aiAgentPath,
    loaded: true,
    exports: {
      MalformedModelOutputError,
      ask: async () => {
        throw new MalformedModelOutputError('bad json');
      },
    },
  };

  const { app } = require('../src/server');
  const server = app.listen(0, '127.0.0.1');

  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => {
    server.close();
    delete require.cache[require.resolve('../src/server')];
    delete require.cache[aiAgentPath];
  });

  const response = await request(server, {
    method: 'POST',
    path: '/api/ask',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider': 'openrouter',
      'X-Model': 'openai/gpt-4o-mini',
      'X-Provider-Key': 'test-key',
    },
    body: { query: 'best T5 PvP build' },
  });

  assert.strictEqual(response.statusCode, 503);
  assert.strictEqual(response.body.error, 'AI service temporarily unavailable');
});
