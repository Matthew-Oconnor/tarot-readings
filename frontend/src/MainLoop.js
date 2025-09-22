// MainLoop.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from './Button';
import ResponseContainer from './ResponseContainer';
import RandomCardsPrompt from './RandomCardsPrompt';
import ClassicSpread from './ClassicSpread';
import './MainLoop.css';

const MainLoop = () => {
  const [scene, setScene] = useState('welcome');
  const [fade, setFade] = useState(false);
  const [spreadFade, setSpreadFade] = useState(false);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setFade(true), 100);
    return () => clearTimeout(t);
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
      try {
        const res = await axios.post('/api/psychic/intro', {});
        setResponseText(res.data.response);
      } catch (err) {
        console.error('intro error:', err?.message);
        setResponseText('An error occurred while typing.');
      } finally {
        setFade(true);
        setScene('prompt');
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
            key={responseText}              // remount when text changes
            text={responseText}
            fade={fade}
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
