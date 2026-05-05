require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const { introPrompt } = require('./templates/psychic');
const { psychicSpread } = require('./templates/spread');

const app = express();
const port = process.env.PORT || 5001;

// These names are “OPENAI_*” but you’re actually targeting Ollama.
// Keep env names for compatibility with deployments.
const MODEL = process.env.CURRENT_MODEL || 'tinyllama';
const OLLAMA_BASE_URL = (process.env.OPENAI_BASE_URL || 'http://itworksonmymachine:11434').replace(/\/$/, '');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

function createOllamaClient() {
  return axios.create({
    baseURL: OLLAMA_BASE_URL,
    timeout: 60_000,
    headers: { 'Content-Type': 'application/json' },
    // Don’t throw automatically so we can inspect body on non-2xx.
    validateStatus: () => true,
  });
}

async function readStreamBody(stream) {
  let text = '';

  for await (const chunk of stream) {
    text += chunk.toString('utf8');
  }

  return text;
}

function buildOllamaRequest({ model, messages, prompt, options, stream = false }) {
  if (Array.isArray(messages)) {
    return {
      endpoint: '/api/chat',
      body: {
        model,
        messages,
        stream,
        options: options || undefined,
      },
      mode: 'chat',
    };
  }

  return {
    endpoint: '/api/generate',
    body: {
      model,
      prompt: typeof prompt === 'string' ? prompt : messagesToPrompt(messages),
      stream,
      options: options || undefined,
    },
    mode: 'generate',
  };
}

/**
 * Call Ollama in a non-streaming way and return a clean text response.
 *
 * Uses /api/chat if you provide messages.
 * Falls back to /api/generate by converting messages -> prompt.
 */
async function ollamaRequest({ model, messages, prompt, options }) {
  const client = createOllamaClient();
  const request = buildOllamaRequest({ model, messages, prompt, options, stream: false });
  const r = await client.post(request.endpoint, request.body);

  if (r.status < 200 || r.status >= 300) {
    const detail = r.data || r.statusText;
    const err = new Error(`Ollama ${request.endpoint} failed: ${r.status}`);
    err.status = r.status;
    err.detail = detail;
    throw err;
  }

  const text = request.mode === 'chat'
    ? (r.data?.message?.content ?? '').trim()
    : (r.data?.response ?? '').trim();

  return { text, raw: r.data, mode: request.mode };
}

async function ollamaStreamText({ req, res, model, messages, prompt, options }) {
  const client = createOllamaClient();
  const request = buildOllamaRequest({ model, messages, prompt, options, stream: true });
  const r = await client.post(request.endpoint, request.body, {
    responseType: 'stream',
  });

  if (r.status < 200 || r.status >= 300) {
    const detail = await readStreamBody(r.data);
    const err = new Error(`Ollama ${request.endpoint} failed: ${r.status}`);
    err.status = r.status;
    err.detail = detail || r.statusText;
    throw err;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const upstream = r.data;
  let closed = false;
  let buffer = '';

  res.on('close', () => {
    if (res.writableEnded) {
      return;
    }

    closed = true;
    upstream.destroy();
  });

  for await (const chunk of upstream) {
    if (closed) {
      return;
    }

    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        console.error('[StreamParseError]', {
          endpoint: request.endpoint,
          line: trimmed,
          message: err.message,
        });
        continue;
      }

      const text = request.mode === 'chat'
        ? parsed?.message?.content
        : parsed?.response;

      if (text) {
        res.write(text);
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    try {
      const parsed = JSON.parse(trailing);
      const text = request.mode === 'chat'
        ? parsed?.message?.content
        : parsed?.response;

      if (text) {
        res.write(text);
      }
    } catch (err) {
      console.error('[StreamParseError]', {
        endpoint: request.endpoint,
        line: trailing,
        message: err.message,
      });
    }
  }

  res.end();
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
    // Your template returns messages; use /api/chat if possible.
    const messages = introPrompt({});

    const { text, mode, raw } = await ollamaRequest({
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
        done: raw?.done ?? true,
      },
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/intro' });
  }
});

app.post('/api/psychic/intro/stream', async (req, res) => {
  try {
    const messages = introPrompt({});

    await ollamaStreamText({
      req,
      res,
      model: MODEL,
      messages,
    });
  } catch (err) {
    if (!res.headersSent) {
      return sendDownstreamError(res, err, { route: '/api/psychic/intro/stream' });
    }

    console.error('[DownstreamError]', {
      route: '/api/psychic/intro/stream',
      status: err.status,
      message: err.message,
      detail: err.detail,
    });

    res.end();
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

    const { text, mode, raw } = await ollamaRequest({
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
        done: raw?.done ?? true,
        done_reason: raw?.done_reason,
        eval_count: raw?.eval_count,
        total_duration: raw?.total_duration,
      },
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/spread' });
  }
});

app.post('/api/psychic/spread/stream', async (req, res) => {
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

    await ollamaStreamText({
      req,
      res,
      model: MODEL,
      messages,
    });
  } catch (err) {
    if (!res.headersSent) {
      return sendDownstreamError(res, err, { route: '/api/psychic/spread/stream' });
    }

    console.error('[DownstreamError]', {
      route: '/api/psychic/spread/stream',
      status: err.status,
      message: err.message,
      detail: err.detail,
    });

    res.end();
  }
});

app.get('/healthz', async (req, res) => {
  // lightweight health check (doesn't require the model to run)
  return res.json({ ok: true, ollama: OLLAMA_BASE_URL, model: MODEL });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Ollama base: ${OLLAMA_BASE_URL}`);
  console.log(`Model: ${MODEL}`);
});
