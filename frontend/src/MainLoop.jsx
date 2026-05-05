// MainLoop.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Button from './Button';
import ResponseContainer from './ResponseContainer';
import RandomCardsPrompt from './RandomCardsPrompt';
import ClassicSpread from './ClassicSpread';
import { streamText } from './streamText';
import { applyStreamUpdate } from './applyStreamUpdate';
import './MainLoop.css';

const MainLoop = () => {
  const [scene, setScene] = useState('welcome');
  const [fade, setFade] = useState(false);
  const [spreadFade, setSpreadFade] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isIntroStreaming, setIsIntroStreaming] = useState(false);
  const introAbortRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setFade(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
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

  const handleClick = async () => {
    setFade(false);
    setTimeout(async () => {
      introAbortRef.current?.abort();
      const controller = new AbortController();
      introAbortRef.current = controller;

      setResponseText('');
      setScene('prompt');
      setFade(true);
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
    }, 2000);
  };

  // stable callback (identity doesn't change)
  const handleFinishTyping = useCallback(() => {
    setScene('fan-cards');
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
      {scene === 'welcome' && (
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
          <RandomCardsPrompt fade={spreadFade} startTheSpread={startTheSpread} />
        </>
      )}

      {scene === 'classic-spread' && <ClassicSpread />}
    </div>
  );
};

export default MainLoop;
