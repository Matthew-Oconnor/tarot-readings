// MainLoop.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Button from './Button';
import ResponseContainer from './ResponseContainer';
import RandomCardsPrompt from './RandomCardsPrompt';
import ClassicSpread from './ClassicSpread';
import { streamText } from './streamText';
import { applyStreamUpdate } from './applyStreamUpdate';
import './MainLoop.css';

const TOTAL_CARDS = 78;
const CARDS_TO_DISPLAY = 3;

function createRandomSpread() {
  const numbers = new Set();
  const cards = [];

  while (numbers.size < CARDS_TO_DISPLAY) {
    const randomNum = Math.floor(Math.random() * TOTAL_CARDS) + 1;

    if (!numbers.has(randomNum)) {
      numbers.add(randomNum);
      cards.push({
        number: randomNum,
        inverted: Math.random() < 0.5,
      });
    }
  }

  return cards;
}

function isGuardianRitualAutostart() {
  const params = new URLSearchParams(window.location.search);
  return params.get('embed') === 'spatial' && params.get('autostart') === 'guardian-ritual';
}

const MainLoop = () => {
  const [guardianAutostart] = useState(isGuardianRitualAutostart);
  const [scene, setScene] = useState('welcome');
  const [fade, setFade] = useState(false);
  const [spreadFade, setSpreadFade] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isIntroStreaming, setIsIntroStreaming] = useState(false);
  const [selectedCards, setSelectedCards] = useState(() => createRandomSpread());
  const introAbortRef = useRef(null);
  const introStartTimeoutRef = useRef(null);
  const hasStartedIntroRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setFade(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (introStartTimeoutRef.current) {
        clearTimeout(introStartTimeoutRef.current);
      }
      introAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (scene === 'fan-cards') {
      const t = setTimeout(() => setSpreadFade(true), 100);
      return () => clearTimeout(t);
    } else {
      setSpreadFade(false);
    }
  }, [scene]);

  const beginIntroRitual = useCallback(({ delayMs = 2000, revealCardsImmediately = false } = {}) => {
    if (hasStartedIntroRef.current) {
      return;
    }

    hasStartedIntroRef.current = true;
    setFade(false);
    if (introStartTimeoutRef.current) {
      clearTimeout(introStartTimeoutRef.current);
    }

    introStartTimeoutRef.current = setTimeout(async () => {
      introStartTimeoutRef.current = null;
      introAbortRef.current?.abort();
      const controller = new AbortController();
      introAbortRef.current = controller;

      setSelectedCards(createRandomSpread());
      setResponseText('');
      setScene(revealCardsImmediately ? 'fan-cards' : 'prompt');
      setFade(true);
      setSpreadFade(revealCardsImmediately);
      setIsIntroStreaming(true);

      try {
        await streamText('/api/psychic/intro/stream', {
          body: {},
          signal: controller.signal,
          onChunk: (_chunk, fullText) => {
            applyStreamUpdate(setResponseText, fullText);
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }

        console.error('intro error:', err?.message);
        setResponseText('An error occurred while typing.');
      } finally {
        if (introAbortRef.current === controller) {
          introAbortRef.current = null;
          setIsIntroStreaming(false);
        }
      }
    }, delayMs);
  }, []);

  useEffect(() => {
    if (guardianAutostart) {
      beginIntroRitual({ delayMs: 0, revealCardsImmediately: true });
    }
  }, [beginIntroRitual, guardianAutostart]);

  const handleClick = () => {
    beginIntroRitual();
  };

  // stable callback (identity doesn't change)
  const handleFinishTyping = useCallback(() => {
    setScene('fan-cards');
  }, []);

  const shuffleCards = useCallback(() => {
    setSelectedCards(createRandomSpread());
  }, []);

  const startTheSpread = useCallback(() => {
    setFade(false);
    setSpreadFade(false);
    setTimeout(() => {
      setScene('classic-spread');
      setFade(true);
    }, 1000);
  }, []);

  // helpful for debugging perceived "state not updated"
  useEffect(() => {
    // console.log('scene ->', scene);
  }, [scene]);

  return (
    <div className={`MainLoop-container ${fade ? 'fade-in' : 'fade-out'}`}>
      {scene === 'welcome' && !guardianAutostart && (
        <Button onClick={handleClick} fade={fade}>
          Hello traveler...
        </Button>
      )}

      {(scene === 'prompt' || scene === 'fan-cards') && (
        <>
          <ResponseContainer
            text={responseText}
            fade={fade}
            isStreaming={isIntroStreaming}
            // only trigger transition when in 'prompt'
            onTypingComplete={scene === 'prompt' ? handleFinishTyping : undefined}
          />
          <RandomCardsPrompt
            fade={spreadFade}
            selectedCards={selectedCards}
            onShuffleCards={shuffleCards}
            startTheSpread={startTheSpread}
          />
        </>
      )}

      {scene === 'classic-spread' && (
        <ClassicSpread selectedCards={selectedCards} onShuffleCards={shuffleCards} />
      )}
    </div>
  );
};

export default MainLoop;
