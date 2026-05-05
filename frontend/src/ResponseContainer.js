// ResponseContainer.js
import React, { memo, useEffect, useRef } from 'react';
import './ResponseContainer.css';

const ResponseContainer = ({ text, fade, isStreaming = false, onTypingComplete }) => {
  const safeText = typeof text === 'string' ? text : '';
  const completedRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      completedRef.current = false;
      return;
    }

    if (!completedRef.current && safeText !== '' && onTypingComplete) {
      completedRef.current = true;
      onTypingComplete();
    }
  }, [isStreaming, onTypingComplete, safeText]);

  return (
    <div className={`Response-container ${fade ? 'fade-in' : 'fade-out'}`}>
      {safeText !== '' && (
        <p className="Response-text">
          {safeText}
          {isStreaming && <span className="Response-cursor" aria-hidden="true" />}
        </p>
      )}
    </div>
  );
};

// prevent re-renders if props are identical
export default memo(ResponseContainer);
