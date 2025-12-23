require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const { introPrompt } = require('./templates/psychic');
const { psychicSpread } = require('./templates/spread');

const app = express();
const port = process.env.PORT || 5001;

const DEFAULT_SIMPHONI_BASE_URL = 'https://simphoni-api.ngrok.app';
const DEFAULT_MODEL = 'gpt-oss:20b';
const rawTimeout = Number(process.env.SIMPHONI_TIMEOUT_MS || 120000);
const SIMPHONI_TIMEOUT_MS = Number.isFinite(rawTimeout) ? rawTimeout : 120000;

const MODEL = process.env.SIMPHONI_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

const FALLBACK_BASES = [
  DEFAULT_SIMPHONI_BASE_URL,
  'http://127.0.0.1:11435',
  'http://localhost:11435',
  'http://127.0.0.1:20801',
  'http://localhost:20801',
  'http://127.0.0.1:20900',
  'http://localhost:20900',
];

const SIMPHONI_BASE_URLS = buildBaseList([
  process.env.SIMPHONI_API_BASE_URL,
  process.env.SIMPHONI_BASE_URL,
  process.env.OPENAI_BASE_URL,
  ...FALLBACK_BASES,
]);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function cleanBase(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

function buildBaseList(values = []) {
  const seen = new Set();
  const bases = [];
  values.forEach((value) => {
    const cleaned = cleanBase(value);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    bases.push(cleaned);
  });
  return bases;
}

/**
 * Turn chat-style messages into a single prompt string for /api/generate.
 * This keeps your template system intact even if it produces messages arrays.
 */
function messagesToPrompt(messages) {
  if (!Array.isArray(messages)) return String(messages || '');

  return messages
    .map((m) => {
      const role = (m?.role || 'user').toUpperCase();
      const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
      return `${role}: ${content}`;
    })
    .join('\n')
    .concat('\nASSISTANT:');
}

function extractTextFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.response === 'string') return payload.response;
  if (payload.message && typeof payload.message.content === 'string') {
    return payload.message.content;
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (choice?.delta?.content) return choice.delta.content;
  if (choice?.message?.content) return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;
  return null;
}

function parseSseLine(rawLine) {
  let line = rawLine.trim();
  if (!line) return null;
  if (line === '[DONE]' || line === 'data: [DONE]') {
    return { done: true };
  }
  if (line.startsWith(':')) return null;
  if (line.startsWith('data:')) {
    line = line.slice('data:'.length).trim();
  }
  if (!line) return null;

  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return null;
  }

  if (payload?.error) {
    return { error: payload.error, payload };
  }

  const text = extractTextFromPayload(payload);
  const done = payload?.done === true;
  return { text, done, payload };
}

function mergeStreamedText(current, next) {
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  return current + next;
}

function readStreamToString(stream) {
  if (!stream) return Promise.resolve('');
  if (typeof stream === 'string') return Promise.resolve(stream);
  if (Buffer.isBuffer(stream)) return Promise.resolve(stream.toString('utf8'));
  if (typeof stream.on !== 'function') return Promise.resolve('');

  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (chunk) => {
      data += chunk.toString('utf8');
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

function collectSseText(stream) {
  return new Promise((resolve, reject) => {
    if (!stream || typeof stream.on !== 'function') {
      resolve({ text: '', raw: null, done: false });
      return;
    }

    let buffer = '';
    let aggregate = '';
    let lastPayload = null;
    let done = false;
    let settled = false;

    const cleanup = () => {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };

    const finalize = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ text: aggregate.trim(), raw: lastPayload, done });
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const handleLine = (line) => {
      const parsed = parseSseLine(line);
      if (!parsed) return;
      if (parsed.payload) lastPayload = parsed.payload;
      if (parsed.error) {
        fail(new Error(parsed.error));
        return;
      }
      if (parsed.done) done = true;
      if (parsed.text) aggregate = mergeStreamedText(aggregate, parsed.text);
    };

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      lines.forEach(handleLine);
    };

    const onEnd = () => {
      if (buffer) {
        handleLine(buffer);
      }
      finalize();
    };

    const onError = (err) => {
      fail(err);
    };

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}

async function postSimphoniStream(baseUrl, path, payload) {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: SIMPHONI_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'ngrok-skip-browser-warning': 'true',
    },
    responseType: 'stream',
    validateStatus: () => true,
  });

  const response = await client.post(path, payload);

  if (response.status < 200 || response.status >= 300) {
    const detail = await readStreamToString(response.data);
    const err = new Error(`Simphoni ${path} failed: ${response.status}`);
    err.status = response.status;
    err.detail = detail || response.statusText;
    err.baseUrl = baseUrl;
    throw err;
  }

  return collectSseText(response.data);
}

async function attemptSimphoniRequest(path, payload) {
  let lastError;
  for (const baseUrl of SIMPHONI_BASE_URLS) {
    try {
      const result = await postSimphoniStream(baseUrl, path, payload);
      return { ...result, baseUrl };
    } catch (err) {
      err.baseUrl = err.baseUrl || baseUrl;
      lastError = err;
      console.warn('[Simphoni] request failed', {
        baseUrl,
        path,
        message: err?.message,
      });
    }
  }
  throw lastError || new Error('No Simphoni endpoints succeeded.');
}

/**
 * Call Simphoni /api/chat or /api/generate and return a clean text response.
 */
async function simphoniRequest({ model, messages, prompt, options }) {
  const useChat = Array.isArray(messages) && messages.length > 0;
  const mode = useChat ? 'chat' : 'generate';
  const path = useChat ? '/api/chat' : '/api/generate';

  const payload = { model, stream: true };
  if (useChat) {
    payload.messages = messages;
  } else {
    const finalPrompt = typeof prompt === 'string' ? prompt : messagesToPrompt(messages);
    payload.prompt = finalPrompt;
  }
  if (options) {
    payload.options = options;
  }

  const { text, raw, done, baseUrl } = await attemptSimphoniRequest(path, payload);
  return { text, raw, done, mode, baseUrl, path };
}

/**
 * Unified error responder.
 */
function sendDownstreamError(res, err, context = {}) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 502;

  // Log something actually useful
  console.error('[DownstreamError]', {
    status,
    message: err.message,
    detail: err.detail,
    baseUrl: err.baseUrl,
    ...context,
  });

  return res.status(status).json({
    error: 'Language service error',
    status,
    message: err.message,
    detail: err.detail,
  });
}

app.post('/api/psychic/intro', async (req, res) => {
  try {
    const messages = introPrompt({});

    const { text, mode, raw, done, baseUrl } = await simphoniRequest({
      model: MODEL,
      messages,
      // You can set generation options here if desired:
      // options: { temperature: 0.7 }
    });

    return res.json({
      response: text,
      meta: {
        model: raw?.model ?? MODEL,
        mode,
        done: raw?.done ?? done ?? true,
        base_url: baseUrl,
      },
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/intro' });
  }
});

app.post('/api/psychic/spread', async (req, res) => {
  try {
    const { cards = [], tone = 'warm' } = req.body || {};

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: '`cards` must be a non-empty array.' });
    }

    const normalized = cards.slice(0, 3).map((c) => ({
      number: Number(c?.number),
      inverted: !!c?.inverted,
    }));

    const bad = normalized.find((c) => Number.isNaN(c.number));
    if (bad) {
      return res.status(400).json({ error: 'Each card must include a numeric `number`.' });
    }

    const messages = psychicSpread({ cards: normalized, tone });

    const { text, mode, raw, done, baseUrl } = await simphoniRequest({
      model: MODEL,
      messages,
      // options: { temperature: 0.8, top_p: 0.9 }
    });

    return res.json({
      response: text,
      used: { cards: normalized },
      meta: {
        model: raw?.model ?? MODEL,
        mode,
        done: raw?.done ?? done ?? true,
        done_reason: raw?.done_reason,
        eval_count: raw?.eval_count,
        total_duration: raw?.total_duration,
        base_url: baseUrl,
      },
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/spread' });
  }
});

app.get('/healthz', async (req, res) => {
  // lightweight health check (doesn't require the model to run)
  return res.json({
    ok: true,
    simphoni: SIMPHONI_BASE_URLS,
    model: MODEL,
    timeout_ms: SIMPHONI_TIMEOUT_MS,
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Simphoni bases: ${SIMPHONI_BASE_URLS.join(', ')}`);
  console.log(`Model: ${MODEL}`);
});
