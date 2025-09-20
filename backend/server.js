require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { introPrompt } = require('./templates/psychic')
const { psychicSpread } = require('./templates/spread')
const app = express();
const port = process.env.PORT || 5001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

if (!OPENAI_API_KEY) {
  console.warn('[WARN] OPENAI_API_KEY is not set. Requests will fail.');
}

app.use(cors());
app.use(express.json());

app.post('/api/psychic/intro', async (req, res) => {
  const messages = introPrompt({});

  try {
    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      { model: OPENAI_MODEL, messages, temperature: 0.8, max_tokens: 220 },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 25_000,
      }
    );

    const aiResponse = response?.data?.choices?.[0]?.message?.content?.trim() ?? '';
    return res.json({ response: aiResponse });
  } catch (error) {
    // 1) Downstream responded with error
    if (error.response) {
      console.error(
        `OpenAI error ${error.response.status}:`,
        error.response.data ?? error.response.statusText
      );
      return res
        .status(error.response.status)
        .json({ error: error.response.data || error.response.statusText });
    }

    // 2) No response
    if (error.request) {
      console.error('No response from OpenAI:', error.request);
      return res.status(502).json({ error: 'No response from language service' });
    }

    // 3) Setup error
    console.error('Request construction error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/psychic/spread', async (req, res) => {
  try {
    const { cards = [], tone = 'warm' } = req.body || {};

    // Basic validation
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: '`cards` must be a non-empty array.' });
    }

    // Normalize first three cards
    const normalized = cards.slice(0, 3).map((c) => ({
      number: Number(c?.number),
      inverted: !!c?.inverted,
    }));

    // Validate numbers
    const bad = normalized.find((c) => Number.isNaN(c.number));
    if (bad) {
      return res.status(400).json({ error: 'Each card must include a numeric `number`.' });
    }

    const messages = psychicSpread({ cards: normalized, tone });

    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      { model: OPENAI_MODEL, messages, temperature: 0.8, max_tokens: 350 },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 25_000,
      }
    );

    const aiResponse = response?.data?.choices?.[0]?.message?.content?.trim() ?? '';

    // Optional: if you want to return resolved names/positions to the UI,
    // uncomment the import above and the next line:
    // const resolved = resolveCards(normalized);

    return res.json({
      response: aiResponse,
      used: { cards: normalized },
    });
  } catch (error) {
    if (error.response) {
      console.error(`OpenAI error ${error.response.status}:`, error.response.data ?? error.response.statusText);
      return res.status(error.response.status).json({ error: error.response.data || error.response.statusText });
    }
    if (error.request) {
      console.error('No response from OpenAI:', error.request);
      return res.status(502).json({ error: 'No response from language service' });
    }
    console.error('Request construction error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});