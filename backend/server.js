require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { introPrompt } = require('./templates/psychic');
const { psychicSpread } = require('./templates/spread');
const {
  buildClientConfig,
  healthMetadata,
  requestLanguage,
} = require('./lib/simphoniClient');

const app = express();
const port = process.env.PORT || 5001;
const simphoniConfig = buildClientConfig();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function normalizeCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    const err = new Error('`cards` must be a non-empty array.');
    err.status = 400;
    throw err;
  }

  const normalized = cards.slice(0, 3).map((card) => ({
    number: Number(card?.number),
    inverted: Boolean(card?.inverted),
  }));

  if (normalized.some((card) => Number.isNaN(card.number))) {
    const err = new Error('Each card must include a numeric `number`.');
    err.status = 400;
    throw err;
  }

  return normalized;
}

function responseMeta(result) {
  return {
    provider: simphoniConfig.provider,
    model: result.raw?.model ?? simphoniConfig.model,
    mode: result.mode,
    endpoint: result.endpoint,
    base_url: result.baseUrl,
    streaming: result.streaming,
    done: result.raw?.done ?? result.done ?? true,
    done_reason: result.raw?.done_reason,
    eval_count: result.raw?.eval_count,
    total_duration: result.raw?.total_duration,
    parse_error_count: result.parseErrors?.length || 0,
  };
}

function sendDownstreamError(res, err, context = {}) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 502;

  console.error('[LanguageServiceError]', {
    status,
    code: err.code,
    message: err.message,
    detail: err.detail,
    attempts: err.attempts,
    ...context,
  });

  return res.status(status).json({
    error: 'Language service error',
    status,
    code: err.code || 'language_service_error',
    message: err.message,
    detail: err.detail,
    attempts: err.attempts,
  });
}

async function runReading({ messages, onText }) {
  return requestLanguage({
    config: simphoniConfig,
    messages,
    onText,
  });
}

async function streamReading(req, res, messages, route) {
  let closed = false;
  let started = false;

  const startStream = () => {
    if (started) return;
    started = true;
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
  };

  req.on('close', () => {
    closed = true;
  });

  try {
    const result = await runReading({
      messages,
      onText: (chunk) => {
        if (!closed) {
          startStream();
          res.write(chunk);
        }
      },
    });

    if (!started && !closed) {
      startStream();
      res.write(result.text || '');
    }
  } catch (err) {
    if (!res.headersSent) {
      return sendDownstreamError(res, err, { route });
    }

    console.error('[LanguageStreamError]', {
      route,
      status: err.status,
      code: err.code,
      message: err.message,
      detail: err.detail,
    });
  }

  if (!closed) {
    res.end();
  }
}

app.post('/api/psychic/intro', async (req, res) => {
  try {
    const messages = introPrompt({});
    const result = await runReading({ messages });

    return res.json({
      response: result.text,
      meta: responseMeta(result),
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/intro' });
  }
});

app.post('/api/psychic/intro/stream', async (req, res) => {
  const messages = introPrompt({});
  return streamReading(req, res, messages, '/api/psychic/intro/stream');
});

app.post('/api/psychic/spread', async (req, res) => {
  try {
    const { cards = [], tone = 'warm' } = req.body || {};
    const normalized = normalizeCards(cards);
    const messages = psychicSpread({ cards: normalized, tone });
    const result = await runReading({ messages });

    return res.json({
      response: result.text,
      used: { cards: normalized },
      meta: responseMeta(result),
    });
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/spread' });
  }
});

app.post('/api/psychic/spread/stream', async (req, res) => {
  try {
    const { cards = [], tone = 'warm' } = req.body || {};
    const normalized = normalizeCards(cards);
    const messages = psychicSpread({ cards: normalized, tone });
    return streamReading(req, res, messages, '/api/psychic/spread/stream');
  } catch (err) {
    return sendDownstreamError(res, err, { route: '/api/psychic/spread/stream' });
  }
});

app.get('/healthz', async (req, res) => {
  return res.json({
    ok: true,
    language: healthMetadata(simphoniConfig),
  });
});

if (require.main === module) {
  app.listen(port, () => {
    const health = healthMetadata(simphoniConfig);
    console.log(`Server running on port ${port}`);
    console.log(`Language provider: ${health.provider}`);
    console.log(`Model configured: ${health.model_configured ? health.model : 'no'}`);
    console.log(`Base URLs: ${health.base_urls.join(', ') || 'none'}`);
  });
}

module.exports = {
  app,
  normalizeCards,
  responseMeta,
  sendDownstreamError,
};
