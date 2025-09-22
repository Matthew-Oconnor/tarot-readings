
function introPrompt({} = {}) {
  return [
    {
      role: 'system',
      content:
        'You are an esteemed, empathetic tarot psychic who speaks in short, vivid paragraphs. Avoid concrete predictions; focus on possibilities and reflection.',
    },
    {
      role: 'user',
      content: [
        'Entice the requester to do a tarot reading in four sentences.',
      ].join(' '),
    },
  ];
}

module.exports = { introPrompt };
