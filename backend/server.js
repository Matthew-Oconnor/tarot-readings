require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const { introPrompt } = require('./templates/psychic');
const { psychicSpread } = require('./templates/spread');

const app = express();
const port = process.env.PORT || 5001;

// These names are “OPENAI_*” but you’re actually targeting Ollama.
// Keep env names for compatibility, but treat them as OLLAMA_*.
const MODEL = process.env.OPENAI_MODEL || 'tinyllama';
const OLLAMA_BASE_URL = (process.env.OPENAI_BASE_URL || 'http://192.168.1.10:11434').replace(/\/$/, '');

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

/**
 * Call Ollama in a non-streaming way and return a clean text response.
 *
 * Uses /api/chat if you provide messages.
 * Falls back to /api/generate by converting messages -> prompt.
 */
async function ollamaRequest({ model, messages, prompt, options }) {
  const client = axios.create({
    baseURL: OLLAMA_BASE_URL,
    timeout: 60_000,
    headers: { 'Content-Type': 'application/json' },
    // Don’t throw automatically so we can print body on non-2xx.
    validateStatus: () => true,
  });

  // Prefer chat if messages provided.
  if (Array.isArray(messages)) {
    const r = await client.post('/api/chat', {
      model,
      messages,
      stream: false, // IMPORTANT: otherwise you get NDJSON streaming
      options: options || undefined,
    });

    if (r.status < 200 || r.status >= 300) {
      const detail = r.data || r.statusText;
      const err = new Error(`Ollama /api/chat failed: ${r.status}`);
      err.status = r.status;
      err.detail = detail;
      throw err;
    }

    // Ollama chat response shape: { message: { role, content }, done, ... }
    const text = (r.data?.message?.content ?? '').trim();
    return { text, raw: r.data, mode: 'chat' };
  }

  // Generate mode.
  const finalPrompt = typeof prompt === 'string' ? prompt : messagesToPrompt(messages);
  const r = await client.post('/api/generate', {
    model,
    prompt: finalPrompt,
    stream: false, // IMPORTANT
    options: options || undefined,
  });

  if (r.status < 200 || r.status >= 300) {
    const detail = r.data || r.statusText;
    const err = new Error(`Ollama /api/generate failed: ${r.status}`);
    err.status = r.status;
    err.detail = detail;
    throw err;
  }

  // Ollama generate response shape: { response: "...", done, ... }
  const text = (r.data?.response ?? '').trim();
  return { text, raw: r.data, mode: 'generate' };
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

app.get('/healthz', async (req, res) => {
  // lightweight health check (doesn't require the model to run)
  return res.json({ ok: true, ollama: OLLAMA_BASE_URL, model: MODEL });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Ollama base: ${OLLAMA_BASE_URL}`);
  console.log(`Model: ${MODEL}`);
});
