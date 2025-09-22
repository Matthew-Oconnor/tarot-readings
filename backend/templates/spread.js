const path = require('path');

const CARDS = require('../data/cards.json');

function resolveCards(cards = []) {
  return cards.slice(0, 3).map((c, idx) => {
    const meta = CARDS.find((x) => x.number === c.number);
    return {
      position: ['The Past', 'The Present', 'The Future'][idx] || `Pos${idx + 1}`,
      name: meta?.name || `Card ${c.number}`,
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
      content:
        'You are an esteemed, empathetic tarot reader. Avoid deterministic prophecy; emphasize reflection, agency, and possibilities. Write vivid but concise paragraphs.',
    },
    {
      role: 'user',
      content: [
        'Perform a three-card reading (Past, Present, Future) for this spread:',
        ...resolved.map(
          (c) => `${c.position}: "${c.name}" (${c.inverted ? 'Inverted' : 'Upright'}).`
        ),
        'The querent is seeking something; infer gently without inventing specifics.',
        'Offer a cohesive arc that connects the three positions.',
      ].join(' '),
    },
  ];
}

module.exports = { psychicSpread };
