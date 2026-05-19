const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const test = require('node:test');

const {
  buildClientConfig,
  buildEndpointAttempts,
  collectStreamText,
  healthMetadata,
  requestLanguage,
} = require('../lib/simphoniClient');

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString('utf8');
  }
  return body ? JSON.parse(body) : {};
}

function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function testConfig(baseUrl, overrides = {}) {
  return buildClientConfig({
    SIMPHONI_API_BASE_URL: baseUrl,
    SIMPHONI_MODEL: 'ministral-3:14b',
    SIMPHONI_TIMEOUT_MS: '1000',
    SIMPHONI_INCLUDE_LOCAL_FALLBACKS: '0',
    ...overrides,
  });
}

test('builds Apex/Simphoni chat attempts before compatibility fallbacks', () => {
  const attempts = buildEndpointAttempts({
    model: 'ministral-3:14b',
    messages: [{ role: 'user', content: 'Read the cards.' }],
    stream: true,
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.path),
    ['/api/chat', '/v1/chat/completions', '/api/generate'],
  );
  assert.equal(attempts[0].body.model, 'ministral-3:14b');
  assert.equal(attempts[0].body.stream, true);
  assert.deepEqual(attempts[0].body.messages, [{ role: 'user', content: 'Read the cards.' }]);
});

test('collects newline and SSE stream chunks split across frames', async () => {
  const stream = Readable.from([
    'data: {"response":"Hel',
    'lo"}\n',
    'not json\n',
    '{"response":"Hello world"}\n',
    'data: [DONE]\n',
  ]);
  const deltas = [];

  const result = await collectStreamText(stream, {
    onText: (delta, fullText) => deltas.push({ delta, fullText }),
  });

  assert.equal(result.text, 'Hello world');
  assert.equal(result.done, true);
  assert.equal(result.parseErrors.length, 1);
  assert.deepEqual(deltas, [
    { delta: 'Hello', fullText: 'Hello' },
    { delta: ' world', fullText: 'Hello world' },
  ]);
});

test('falls back from /api/chat to OpenAI-compatible streaming endpoint', async () => {
  const calls = [];
  const { server, baseUrl } = await startMockServer(async (req, res) => {
    const body = await readJsonBody(req);
    calls.push({ path: req.url, body });

    if (req.url === '/api/chat') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('chat route unavailable');
      return;
    }

    if (req.url === '/v1/chat/completions') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"fallback"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":" ok"}}]}\n\n');
      res.end('data: [DONE]\n\n');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const result = await requestLanguage({
      config: testConfig(baseUrl),
      messages: [{ role: 'user', content: 'Read the spread.' }],
    });

    assert.equal(result.text, 'fallback ok');
    assert.equal(result.endpoint, '/v1/chat/completions');
    assert.equal(calls[0].body.model, 'ministral-3:14b');
    assert.equal(calls[0].body.stream, true);
    assert.deepEqual(
      calls.map((call) => call.path),
      ['/api/chat', '/v1/chat/completions'],
    );
  } finally {
    await closeServer(server);
  }
});

test('uses non-streaming fallback when streaming is rejected', async () => {
  const calls = [];
  const { server, baseUrl } = await startMockServer(async (req, res) => {
    const body = await readJsonBody(req);
    calls.push({ path: req.url, body });

    if (body.stream === true) {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'streaming disabled' }));
      return;
    }

    if (req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'plain response' }, done: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  try {
    const result = await requestLanguage({
      config: testConfig(baseUrl, { SIMPHONI_NON_STREAMING_FALLBACK: '1' }),
      messages: [{ role: 'user', content: 'Read the spread.' }],
    });

    assert.equal(result.text, 'plain response');
    assert.equal(result.streaming, false);
    assert.equal(result.endpoint, '/api/chat');
    assert.equal(calls.some((call) => call.body.stream === true), true);
    assert.equal(calls.some((call) => call.body.stream === false), true);
  } finally {
    await closeServer(server);
  }
});

test('surfaces timeout failures without leaking configured credentials', async () => {
  const { server, baseUrl } = await startMockServer(async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response: 'too late' }));
  });

  try {
    await assert.rejects(
      requestLanguage({
        config: testConfig(baseUrl, {
          SIMPHONI_TIMEOUT_MS: '30',
          SIMPHONI_NON_STREAMING_FALLBACK: '0',
        }),
        messages: [{ role: 'user', content: 'Read the spread.' }],
      }),
      (err) => {
        assert.equal(err.code, 'simphoni_all_routes_failed');
        assert.equal(err.status, 504);
        assert.equal(err.attempts.every((attempt) => attempt.code === 'simphoni_timeout'), true);
        return true;
      },
    );
  } finally {
    await closeServer(server);
  }
});

test('health metadata redacts credentials from base URLs', () => {
  const config = testConfig('https://user:secret@example.test/api');
  const health = healthMetadata(config);

  assert.equal(health.base_url_configured, true);
  assert.deepEqual(health.base_urls, ['https://example.test/api']);
  assert.equal(health.model_configured, true);
});
