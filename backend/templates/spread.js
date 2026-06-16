const path = require('path');

const CARDS = require('../data/cards.json');

function resolveCards(cards = []) {
  return cards.slice(0, 3).map((c, idx) => {
    const meta = CARDS.find((x) => x.number === c.number);
    const suppliedName = typeof c.name === 'string' ? c.name.trim() : '';
    const suppliedPosition = typeof c.position === 'string' ? c.position.trim() : '';
    return {
      position: suppliedPosition || ['The Past', 'The Present', 'The Future'][idx] || `Pos${idx + 1}`,
      name: suppliedName || meta?.name || `Card ${c.number}`,
      inverted: !!c.inverted,
      // add more meta if your prompt needs it (keywords/description)
    };
  });
}

function psychicSpread({ cards = [], tone = 'warm' } = {}) {
  const resolved = resolveCards(cards);

return [
  {
    role: 'system',
    content: `
You are an insightful, grounded, and emotionally intelligent tarot reader.

Core principles:
- Do NOT predict fixed outcomes or declare fate.
- Avoid deterministic language (no "this will happen", "you are destined").
- Emphasize reflection, personal agency, patterns, and possibilities.
- Never invent concrete external events or specific life circumstances.
- If context is unknown, speak in universal but resonant human themes.

Tone:
- Warm, perceptive, calm, slightly poetic but never flowery.
- Vivid imagery in moderation.
- Avoid mystical exaggeration or theatrical prophecy.
- Sound wise, not supernatural.

Structure:
- Write exactly 3 sentences for each card (Past, Present, Future).
- Then add a brief 1–2 sentence integrative closing reflection.
- Each paragraph should clearly reference its card and orientation (Upright/Inverted).
- Connect the three cards into a cohesive emotional or developmental arc.

Card Handling:
- Use exactly the three supplied cards in their supplied order and positions.
- Do not redraw, substitute, rename, reorder, or mention any card that is not listed in the spread.
- Upright: express balanced or flowing energy.
- Inverted: frame as blocked, internalized, delayed, misdirected, or calling for integration — not “bad”.
- Avoid simplistic positive/negative labeling.

Constraints:
- 180–260 words total.
- No bullet points.
- No emojis.
- No disclaimers about entertainment purposes.
- Do not mention being an AI.
`
  },
  {
    role: 'user',
    content: [
      'Perform a three-card reading (Past, Present, Future) for this spread:',
      ...resolved.map(
        (c) => `${c.position}: "${c.name}" (${c.inverted ? 'Inverted' : 'Upright'}).`
      ),
      `Card lock: only discuss ${resolved.map((c) => `"${c.name}" as ${c.position}`).join(', ')}.`,
      'The querent is seeking something; infer gently without inventing specifics.',
      'Offer a cohesive arc that connects the three positions.',
    ].join(' ')
  }
];

}

module.exports = { psychicSpread };
