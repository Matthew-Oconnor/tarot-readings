// MainLoop.js
import React, { useState, useEffect } from 'react';
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
    // Trigger fade-in when component mounts
    const fadeInTimeout = setTimeout(() => {
      setFade(true);
    }, 100); // Slight delay to ensure the fade-in effect is noticeable

    return () => clearTimeout(fadeInTimeout);
  }, []);
  
  // New useEffect to handle fade-in for RandomCardsPrompt
  useEffect(() => {
    if (scene === 'fan-cards') {
      // Trigger fade-in after a short delay to ensure the component has mounted
      const spreadFadeInTimeout = setTimeout(() => {
        setSpreadFade(true);
      }, 100); // Adjust delay as needed

      return () => clearTimeout(spreadFadeInTimeout);
    } else {
      // Reset spreadFade when not in 'fan-cards' scene
      setSpreadFade(false);
    }
  }, [scene]);

  const handleClick = async () => {
    setFade(false); // Begin fade-out
  
    setTimeout(async () => {
      try {
        const res = await axios.post('/api/psychic/intro', {
        });
        setResponseText(res.data.response);
      } catch (error) {
        console.error('Error fetching data from backend:', error.message);
        setResponseText('An error occurred while typing.');
      } finally {
        setFade(true);
        setScene('prompt');
      }
    }, 2000);
  };

  const handleFinishTyping = () => {
    setScene('fan-cards');
    console.log('scene is now ' + scene)
  };

  // Define the startTheSpread function to change the scene to 'classic-spread'
  const startTheSpread = () => {
    setFade(false); // Begin fade-out of MainLoop-container
    setSpreadFade(false); // Begin fade-out of RandomCardsPrompt
    console.log('Fading out to classic-spread');

    // Wait for the fade-out duration before changing the scene
    setTimeout(() => {
      setScene('classic-spread');
      setFade(true); // Begin fade-in of MainLoop-container with new scene
    }, 1000);
  };

  return (
    <div className={`MainLoop-container ${fade ? 'fade-in' : 'fade-out'}`}>
      {scene === 'welcome' &&
       <Button onClick={handleClick} fade={fade} >
        Hello traveler...
      </Button> }
      {
        (scene === 'prompt' || scene === 'fan-cards') && 
        <>
          <ResponseContainer 
            text={responseText}
            fade={fade}
            onTypingComplete={handleFinishTyping}
          />
          <RandomCardsPrompt fade={spreadFade} startTheSpread={startTheSpread}/>
        </>
      }
      {
        (scene === 'classic-spread') &&
        <ClassicSpread />
      }
    </div>
  );
};

export default MainLoop;
