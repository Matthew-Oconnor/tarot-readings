// ResponseContainer.js
import React from 'react';
import Typewriter from './Typewriter';
import './ResponseContainer.css'; // Import corresponding CSS

const SPEED_RANGE = [15, 60];

const ResponseContainer = ({ text, fade, onTypingComplete }) => {
  return (
    <div className={`Response-container ${fade ? 'fade-in' : 'fade-out'}`}>
      <Typewriter 
        text={text}
        speedRange={SPEED_RANGE}
        onComplete={onTypingComplete} // Pass callback to Typewriter
      />
    </div>
  );
};

export default ResponseContainer;
