const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_PROVIDER = 'simphoni-apex';
const DEFAULT_LOCAL_BASE_URLS = [
  'http://127.0.0.1:5037',
  'http://127.0.0.1:8768',
  'http://127.0.0.1:11435',
];
const DEFAULT_MAX_ERROR_DETAIL = 500;
let baseUrlCursor = 0;

function cleanBaseUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

function splitCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildBaseList(values = []) {
  const seen = new Set();
  const bases = [];

  values.flat().forEach((value) => {
    const cleaned = cleanBaseUrl(value);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    bases.push(cleaned);
  });

  return bases;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function redactBaseUrl(value) {
  const cleaned = cleanBaseUrl(value);
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return cleaned.replace(/\/\/[^/@]+@/, '//[redacted]@');
  }
}

function sanitizeErrorDetail(detail, maxLength = DEFAULT_MAX_ERROR_DETAIL) {
  if (detail === undefined || detail === null) return undefined;

  let text;
  if (typeof detail === 'string') {
    text = detail;
  } else {
    try {
      text = JSON.stringify(detail);
    } catch {
      text = String(detail);
    }
  }

  text = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/"api[_-]?key"\s*:\s*"[^"]+"/gi, '"api_key":"[redacted]"')
    .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[redacted]"');

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function buildClientConfig(env = process.env) {
  const explicitBases = buildBaseList([
    env.SIMPHONI_API_BASE_URL,
    env.SIMPHONI_BASE_URL,
    env.SIMPHONI_CORE_API_BASE,
    env.SIMPHONI_PY_API_BASE,
    env.SIMPHONI_LLM_GATEWAY_BASE,
    env.OPENAI_BASE_URL,
    env.OLLAMA_BASE_URL,
  ]);

  const configuredFallbacks = buildBaseList([
    splitCsv(env.SIMPHONI_FALLBACK_BASE_URLS),
    splitCsv(env.SIMPHONI_API_FALLBACK_BASE_URLS),
  ]);

  const includeLocalFallbacks = parseBoolean(
    env.SIMPHONI_INCLUDE_LOCAL_FALLBACKS,
    explicitBases.length === 0 && configuredFallbacks.length === 0,
  );

  const fallbackBases = buildBaseList([
    configuredFallbacks,
    includeLocalFallbacks ? DEFAULT_LOCAL_BASE_URLS : [],
  ]);

  return {
    provider: DEFAULT_PROVIDER,
    baseUrls: buildBaseList([explicitBases, fallbackBases]),
    configuredBaseUrls: explicitBases,
    fallbackBaseUrls: fallbackBases,
    model: env.SIMPHONI_MODEL || env.CURRENT_MODEL || env.OPENAI_MODEL || null,
    timeoutMs: parsePositiveInteger(env.SIMPHONI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    streamingEnabled: parseBoolean(env.SIMPHONI_STREAMING_ENABLED, true),
    nonStreamingFallbackEnabled: parseBoolean(env.SIMPHONI_NON_STREAMING_FALLBACK, true),
    rotateBaseUrls: parseBoolean(env.SIMPHONI_ROTATE_BASE_URLS, true),
    apiKey: env.SIMPHONI_API_KEY || env.SIMPHONI_API_TOKEN || null,
  };
}

function messagesToPrompt(messages) {
  if (!Array.isArray(messages)) return String(messages || '');

  return messages
    .map((message) => {
      const role = (message?.role || 'user').toUpperCase();
      const content = typeof message?.content === 'string'
        ? message.content
        : JSON.stringify(message?.content ?? '');
      return `${role}: ${content}`;
    })
    .join('\n')
    .concat('\nASSISTANT:');
}

function extractTextFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.response === 'string') return payload.response;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.content === 'string') return payload.content;
  if (payload.message && typeof payload.message.content === 'string') {
    return payload.message.content;
  }

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (typeof choice?.delta?.content === 'string') return choice.delta.content;
  if (typeof choice?.message?.content === 'string') return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;

  return null;
}

function applyTextUpdate(state, nextText) {
  if (!nextText) return { aggregate: state.aggregate, delta: '' };
  if (!state.aggregate) {
    state.aggregate = nextText;
    return { aggregate: state.aggregate, delta: nextText };
  }
  if (nextText.startsWith(state.aggregate)) {
    const delta = nextText.slice(state.aggregate.length);
    state.aggregate = nextText;
    return { aggregate: state.aggregate, delta };
  }

  state.aggregate += nextText;
  return { aggregate: state.aggregate, delta: nextText };
}

function parseStreamLine(rawLine) {
  let line = String(rawLine || '').trim();
  if (!line) return null;
  if (line.startsWith(':') || line.startsWith('event:') || line.startsWith('id:')) return null;
  if (line === '[DONE]') return { done: true };

  if (line.startsWith('data:')) {
    line = line.slice('data:'.length).trim();
  }

  if (!line) return null;
  if (line === '[DONE]') return { done: true };

  try {
    const payload = JSON.parse(line);
    if (payload?.error) {
      const errorMessage = typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || JSON.stringify(payload.error);
      return { error: errorMessage, payload };
    }

    return {
      text: extractTextFromPayload(payload),
      done: payload.done === true || payload.stop === true,
      payload,
    };
  } catch (error) {
    return {
      parseError: {
        message: error.message,
        line: sanitizeErrorDetail(line, 160),
      },
    };
  }
}

function handleParsedStreamLine(parsed, state, onText) {
  if (!parsed) return;
  if (parsed.parseError) {
    state.parseErrors.push(parsed.parseError);
    return;
  }
  if (parsed.payload) state.lastPayload = parsed.payload;
  if (parsed.error) {
    const error = new Error(parsed.error);
    error.status = 502;
    error.detail = parsed.error;
    throw error;
  }
  if (parsed.done) state.done = true;
  if (parsed.text) {
    const { delta } = applyTextUpdate(state, parsed.text);
    if (delta) onText?.(delta, state.aggregate);
  }
}

async function collectStreamText(stream, { onText } = {}) {
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    return { text: '', raw: null, done: false, parseErrors: [] };
  }

  const state = {
    aggregate: '',
    done: false,
    lastPayload: null,
    parseErrors: [],
  };
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      handleParsedStreamLine(parseStreamLine(line), state, onText);
    }
  }

  if (buffer.trim()) {
    handleParsedStreamLine(parseStreamLine(buffer), state, onText);
  }

  return {
    text: state.aggregate.trim(),
    raw: state.lastPayload,
    done: state.done,
    parseErrors: state.parseErrors,
  };
}

async function readBodyText(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body[Symbol.asyncIterator] !== 'function') return '';

  let text = '';
  for await (const chunk of body) {
    text += chunk.toString('utf8');
  }
  return text;
}

function makeLanguageError(message, options = {}) {
  const error = new Error(message);
  Object.assign(error, options);
  return error;
}

function buildEndpointAttempts({ messages, prompt, options, stream, model }) {
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const promptText = typeof prompt === 'string' ? prompt : messagesToPrompt(messages);
  const requestOptions = options || undefined;

  if (hasMessages) {
    return [
      {
        path: '/api/chat',
        mode: 'chat',
        body: { model, messages, stream, options: requestOptions },
      },
      {
        path: '/v1/chat/completions',
        mode: 'chat.completions',
        body: { model, messages, stream, ...openAiOptions(options) },
      },
      {
        path: '/api/generate',
        mode: 'generate',
        body: { model, prompt: promptText, stream, options: requestOptions },
      },
    ];
  }

  return [
    {
      path: '/api/generate',
      mode: 'generate',
      body: { model, prompt: promptText, stream, options: requestOptions },
    },
    {
      path: '/v1/completions',
      mode: 'completions',
      body: { model, prompt: promptText, stream, ...openAiOptions(options) },
    },
    {
      path: '/api/chat',
      mode: 'chat',
      body: {
        model,
        messages: [{ role: 'user', content: promptText }],
        stream,
        options: requestOptions,
      },
    },
  ];
}

function openAiOptions(options = {}) {
  const mapped = {};
  if (options.temperature !== undefined) mapped.temperature = options.temperature;
  if (options.top_p !== undefined) mapped.top_p = options.top_p;
  if (options.max_tokens !== undefined) mapped.max_tokens = options.max_tokens;
  if (options.num_predict !== undefined) mapped.max_tokens = options.num_predict;
  return mapped;
}

function createAxiosClient(config, baseUrl, responseType) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: responseType === 'stream' ? 'text/event-stream, application/x-ndjson, application/json' : 'application/json',
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return axios.create({
    baseURL: baseUrl,
    timeout: config.timeoutMs,
    responseType,
    headers,
    validateStatus: () => true,
  });
}

async function postEndpoint({ config, baseUrl, endpoint, onText }) {
  const stream = endpoint.body.stream === true;
  const client = createAxiosClient(config, baseUrl, stream ? 'stream' : 'json');
  let response;

  try {
    response = await client.post(endpoint.path, endpoint.body);
  } catch (error) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      throw makeLanguageError('Simphoni request timed out.', {
        status: 504,
        code: 'simphoni_timeout',
        upstream: {
          baseUrl: redactBaseUrl(baseUrl),
          endpoint: endpoint.path,
          mode: endpoint.mode,
        },
      });
    }

    throw makeLanguageError('Simphoni request failed before receiving a response.', {
      status: 502,
      code: 'simphoni_network_error',
      detail: sanitizeErrorDetail(error.message),
      upstream: {
        baseUrl: redactBaseUrl(baseUrl),
        endpoint: endpoint.path,
        mode: endpoint.mode,
      },
    });
  }

  if (response.status < 200 || response.status >= 300) {
    const detail = stream ? await readBodyText(response.data) : response.data;
    throw makeLanguageError(`Simphoni ${endpoint.path} returned ${response.status}.`, {
      status: response.status,
      code: 'simphoni_upstream_error',
      detail: sanitizeErrorDetail(detail),
      upstream: {
        status: response.status,
        baseUrl: redactBaseUrl(baseUrl),
        endpoint: endpoint.path,
        mode: endpoint.mode,
      },
    });
  }

  if (stream) {
    const collected = await collectStreamText(response.data, { onText });
    return {
      ...collected,
      mode: endpoint.mode,
      endpoint: endpoint.path,
      baseUrl: redactBaseUrl(baseUrl),
    };
  }

  const text = extractTextFromPayload(response.data);
  return {
    text: (text || '').trim(),
    raw: response.data,
    done: response.data?.done ?? true,
    parseErrors: [],
    mode: endpoint.mode,
    endpoint: endpoint.path,
    baseUrl: redactBaseUrl(baseUrl),
  };
}

function assertConfigured(config) {
  if (!config.model) {
    throw makeLanguageError('No Simphoni model is configured.', {
      status: 503,
      code: 'simphoni_model_missing',
    });
  }
  if (!config.baseUrls.length) {
    throw makeLanguageError('No Simphoni base URL is configured.', {
      status: 503,
      code: 'simphoni_base_url_missing',
    });
  }
}

async function requestLanguage({ config, messages, prompt, options, onText }) {
  assertConfigured(config);

  const streams = config.streamingEnabled
    ? [true, ...(config.nonStreamingFallbackEnabled ? [false] : [])]
    : [false];
  const failures = [];
  const baseUrls = orderedBaseUrls(config);

  for (const baseUrl of baseUrls) {
    for (const stream of streams) {
      const attempts = buildEndpointAttempts({
        messages,
        prompt,
        options,
        stream,
        model: config.model,
      });

      for (const endpoint of attempts) {
        try {
          const result = await postEndpoint({ config, baseUrl, endpoint, onText: stream ? onText : undefined });
          if (!result.text && !result.done) {
            throw makeLanguageError('Simphoni returned an empty response.', {
              status: 502,
              code: 'simphoni_empty_response',
              upstream: {
                baseUrl: redactBaseUrl(baseUrl),
                endpoint: endpoint.path,
                mode: endpoint.mode,
              },
            });
          }
          return { ...result, streaming: stream };
        } catch (error) {
          failures.push({
            code: error.code,
            status: error.status,
            detail: error.detail,
            upstream: error.upstream || {
              baseUrl: redactBaseUrl(baseUrl),
              endpoint: endpoint.path,
              mode: endpoint.mode,
            },
          });
        }
      }
    }
  }

  const last = failures[failures.length - 1] || {};
  const allTimeouts = failures.length > 0 && failures.every((failure) => failure.code === 'simphoni_timeout');
  throw makeLanguageError('All configured Simphoni language routes failed.', {
    status: allTimeouts ? 504 : (last.status && last.status >= 400 && last.status < 500 ? last.status : 502),
    code: 'simphoni_all_routes_failed',
    detail: last.detail,
    attempts: failures.map((failure) => ({
      code: failure.code,
      status: failure.status,
      upstream: failure.upstream,
    })),
  });
}

function orderedBaseUrls(config) {
  const baseUrls = Array.isArray(config?.baseUrls) ? config.baseUrls.slice() : [];
  if (baseUrls.length <= 1 || config.rotateBaseUrls === false) {
    return baseUrls;
  }

  const offset = baseUrlCursor % baseUrls.length;
  baseUrlCursor = (baseUrlCursor + 1) % baseUrls.length;
  return baseUrls.slice(offset).concat(baseUrls.slice(0, offset));
}

function healthMetadata(config) {
  return {
    provider: config.provider,
    model_configured: Boolean(config.model),
    model: config.model || null,
    base_url_configured: config.configuredBaseUrls.length > 0,
    base_url_count: config.baseUrls.length,
    base_urls: config.baseUrls.map(redactBaseUrl),
    streaming_enabled: config.streamingEnabled,
    non_streaming_fallback_enabled: config.nonStreamingFallbackEnabled,
    rotate_base_urls: config.rotateBaseUrls,
    timeout_ms: config.timeoutMs,
    endpoints: {
      chat: ['/api/chat', '/v1/chat/completions', '/api/generate'],
      generate: ['/api/generate', '/v1/completions', '/api/chat'],
    },
  };
}

module.exports = {
  DEFAULT_LOCAL_BASE_URLS,
  applyTextUpdate,
  buildBaseList,
  buildClientConfig,
  buildEndpointAttempts,
  cleanBaseUrl,
  collectStreamText,
  extractTextFromPayload,
  healthMetadata,
  messagesToPrompt,
  orderedBaseUrls,
  parseBoolean,
  parsePositiveInteger,
  parseStreamLine,
  redactBaseUrl,
  requestLanguage,
  sanitizeErrorDetail,
};
