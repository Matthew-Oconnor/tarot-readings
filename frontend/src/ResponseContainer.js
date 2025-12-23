// ResponseContainer.js
import React, { memo } from 'react';
import Typewriter from './Typewriter';
import './ResponseContainer.css';

const SPEED_RANGE = [5, 40];

const ResponseContainer = ({ text, fade, onTypingComplete }) => {
  const safeText = typeof text === 'string' ? text : '';

  return (
    <div className={`Response-container ${fade ? 'fade-in' : 'fade-out'}`}>
      {safeText !== '' && (
        <Typewriter
          text={safeText}
          speedRange={SPEED_RANGE}
          onComplete={onTypingComplete}
        />
      )}
    </div>
  );
};

// prevent re-renders if props are identical
export default memo(ResponseContainer);
