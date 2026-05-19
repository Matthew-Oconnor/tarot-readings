import React, { useState } from 'react';
import MainLoop from '../MainLoop';
import './TwilightTarotGardenTool.css';

const paletteOptions = [
  {
    name: 'Dusk Bloom',
    description: 'Lavender twilight with rose glow',
    gradient:
      'radial-gradient(circle at 20% 20%, rgba(196, 165, 255, 0.35), transparent 60%), linear-gradient(135deg, rgba(43, 0, 79, 0.92), rgba(13, 1, 41, 0.96))',
    accent: '#f6aaff',
    accentSoft: 'rgba(246, 170, 255, 0.2)',
  },
  {
    name: 'Aurora Ink',
    description: 'Teal starlight shimmering over midnight',
    gradient:
      'radial-gradient(circle at 80% 10%, rgba(87, 242, 255, 0.18), transparent 55%), linear-gradient(160deg, rgba(9, 12, 60, 0.94), rgba(3, 0, 22, 0.94))',
    accent: '#7df3ff',
    accentSoft: 'rgba(125, 243, 255, 0.22)',
  },
  {
    name: 'Golden Hour',
    description: 'Amber lantern light for mythic tales',
    gradient:
      'radial-gradient(circle at 50% 0%, rgba(255, 197, 111, 0.26), transparent 60%), linear-gradient(140deg, rgba(58, 4, 16, 0.96), rgba(11, 0, 41, 0.92))',
    accent: '#ffdf9d',
    accentSoft: 'rgba(255, 223, 157, 0.24)',
  },
];

const storySeeds = [
  'A wandering bard discovers an oracle hidden in a lantern and must trade a memory for a prophecy.',
  'Two rivals draw cards at dawn; the spread insists they must co-write the peace treaty or lose their kingdoms.',
  'A forgotten temple awakens whenever the Moon card appears—what story is it begging you to tell tonight?',
  'The Empress falls from the spread, signaling a missing caretaker in your world. Who answers the call?',
  'An inverted Sun challenges your protagonist to navigate hope through shadowed corridors.',
];

const plotTwists = [
  'The chosen guide is secretly tethered to the antagonist through a sacred vow.',
  'A card repeats three nights in a row, unlocking a hidden location in the story world.',
  'Tarot whispers that the mentor has been reading the protagonist’s diary all along.',
  'The deck refuses to reveal the final card until a side character speaks their truth.',
  'A reversed card amplifies the scene’s soundtrack—lyrics emerge that rewrite the conflict.',
];

const ritualSteps = [
  'Light a candle (real or imagined) and write one line about its color before you draw.',
  'Shuffle the cards while naming three emotions you want in the next scene.',
  'Journal a single sensory detail for each card in your spread; weave them into a paragraph.',
  'Set a timer for five minutes and free-write dialogue sparked by the crossing card.',
  'When you finish, pull one more card and let it title your chapter or poem.',
];

const outlineFields = [
  {
    key: 'openingImage',
    label: 'Opening Image',
    placeholder: 'What visual sets the tone as the spread sparks your scene?',
  },
  {
    key: 'complication',
    label: 'Complication',
    placeholder: 'Which card complicates your protagonist’s plan?',
  },
  {
    key: 'revelation',
    label: 'Revelation',
    placeholder: 'What secret or insight surfaces near the final position?',
  },
];

function TwilightTarotGardenTool({ onClose }) {
  const [notes, setNotes] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [storySeedIndex, setStorySeedIndex] = useState(() =>
    Math.floor(Math.random() * storySeeds.length),
  );
  const [plotTwistIndex, setPlotTwistIndex] = useState(() =>
    Math.floor(Math.random() * plotTwists.length),
  );
  const [ritualIndex, setRitualIndex] = useState(() =>
    Math.floor(Math.random() * ritualSteps.length),
  );
  const [outlineNotes, setOutlineNotes] = useState(() =>
    outlineFields.reduce((memo, field) => ({ ...memo, [field.key]: '' }), {}),
  );

  const activePalette = paletteOptions[paletteIndex];

  const reshuffleSeed = () => {
    setStorySeedIndex((prev) => {
      let next = Math.floor(Math.random() * storySeeds.length);
      if (next === prev) {
        next = (next + 1) % storySeeds.length;
      }
      return next;
    });
  };

  const reshuffleTwist = () => {
    setPlotTwistIndex((prev) => {
      let next = Math.floor(Math.random() * plotTwists.length);
      if (next === prev) {
        next = (next + 1) % plotTwists.length;
      }
      return next;
    });
  };

  const advanceRitual = () => {
    setRitualIndex((prev) => (prev + 1) % ritualSteps.length);
  };

  const updateOutline = (key, value) => {
    setOutlineNotes((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="twilight-tarot-tool"
      style={{
        '--ttg-background': activePalette.gradient,
        '--ttg-accent': activePalette.accent,
        '--ttg-accent-soft': activePalette.accentSoft,
      }}
    >
      <div className="twilight-tarot-aurora" aria-hidden="true" />
      <header className="twilight-tarot-header">
        <div className="twilight-tarot-heading">
          <p className="twilight-tarot-tagline">Creative Writers Mini-App</p>
          <h1>Twilight Tarot Garden</h1>
          <p>
            Fan out the major arcana, invite characters into the spread, and let each
            card spark a scene, poem, or journal entry. Use the spread to map turning
            points or inner monologues before you write.
          </p>
          <p className="twilight-tarot-updates">
            New this season: sculpt the garden’s mood, spin fresh story seeds, and map
            your plot beats alongside the live spread.
          </p>
        </div>
        <button type="button" className="twilight-tarot-close" onClick={onClose}>
          Return to Communiti
        </button>
      </header>

      <div className="twilight-tarot-layout">
        <aside className="twilight-tarot-sidebar">
          <section>
            <h2>Writing with Tarot</h2>
            <ul>
              <li>Click "Hello traveler" to summon an opening invitation to your story world.</li>
              <li>Draw a spread and assign each card to a beat: inciting spark, revelation, or mood.</li>
              <li>Let inverted cards introduce conflict or unexpected character choices.</li>
              <li>After the reading, free-write for five minutes using the cards as guideposts.</li>
            </ul>
          </section>

          <section>
            <h3>Garden Mood Palette</h3>
            <p className="twilight-tarot-section-caption">
              Shift the gradient and accent lights to match the tone of your next scene.
            </p>
            <div className="twilight-tarot-palettes">
              {paletteOptions.map((palette, index) => (
                <button
                  key={palette.name}
                  type="button"
                  className={`twilight-tarot-palette ${
                    index === paletteIndex ? 'is-active' : ''
                  }`}
                  onClick={() => setPaletteIndex(index)}
                >
                  <span className="twilight-tarot-palette-sheen" />
                  <strong>{palette.name}</strong>
                  <span>{palette.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Story Seed</h3>
            <p className="twilight-tarot-section-caption">
              Use the seed as an inciting image or opening paragraph and branch outward.
            </p>
            <div className="twilight-tarot-card twilight-tarot-card--luminous">
              <p>{storySeeds[storySeedIndex]}</p>
              <button type="button" onClick={reshuffleSeed}>
                Draw another seed
              </button>
            </div>
          </section>

          <section>
            <h3>Plot Twist Echo</h3>
            <p className="twilight-tarot-section-caption">
              When the spread settles, drop this twist into the middle of your scene.
            </p>
            <div className="twilight-tarot-card">
              <p>{plotTwists[plotTwistIndex]}</p>
              <button type="button" onClick={reshuffleTwist}>
                Reveal another twist
              </button>
            </div>
          </section>

          <section>
            <h3>Creative Ritual</h3>
            <div className="twilight-tarot-ritual">
              <span className="twilight-tarot-ritual-step">
                Step {ritualIndex + 1} of {ritualSteps.length}
              </span>
              <p>{ritualSteps[ritualIndex]}</p>
              <button type="button" onClick={advanceRitual}>
                Next ritual cue
              </button>
            </div>
          </section>

          <section>
            <h3>Scene Sketchpad</h3>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Capture the character voice, setting details, or bits of dialogue inspired by the cards..."
            />
          </section>

          <section>
            <h3>Three-Beat Outline</h3>
            <p className="twilight-tarot-section-caption">
              Anchor the spread to your narrative arc while it is fresh.
            </p>
            <div className="twilight-tarot-outline">
              {outlineFields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <textarea
                    value={outlineNotes[field.key]}
                    onChange={(event) => updateOutline(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3>Prompt Hooks</h3>
            <ul>
              <li>Pair the Fool with a setting to start a journey-focused scene.</li>
              <li>Use the card crossing the present as the obstacle your protagonist resists.</li>
              <li>Translate the final outcome card into the last line of a poem or chapter.</li>
            </ul>
          </section>
        </aside>

        <div className="twilight-tarot-main">
          <div className="twilight-tarot-main-banner">
            <p>
              Ready to write? Choose a palette, spin a story seed, then click into the
              live wave of cards to conjure your next chapter.
            </p>
          </div>
          <MainLoop />
        </div>
      </div>
    </div>
  );
}

export default TwilightTarotGardenTool;
