import React, { useState, useEffect } from 'react';
import './Typewriter.css';

const Typewriter = ({ text, speedRange, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let index = 0;
    let isCancelled = false;

    // Reset state when `text` changes
    setDisplayedText(text.charAt(index));
    setIsCompleted(false);

    const typeNextCharacter = () => {
      if (isCancelled) return;

      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
        const [min, max] = speedRange;
        const randomDelay = Math.floor(Math.random() * (max - min + 1)) + min;
        setTimeout(typeNextCharacter, randomDelay);
      } else {
        setIsCompleted(true);
      }
    };

    typeNextCharacter();

    return () => {
      isCancelled = true;
    };
  }, [text, speedRange]);

  useEffect(() => {
    if (isCompleted && text.length > 0) {
      console.log("typewriter is handling")
      onComplete(); // Invoke callback only when typing is fully complete
    }
  }, [isCompleted]);

  return (
    <div>
      <p className="Typewriter-text">{displayedText}</p>
    </div>
  );
};

export default Typewriter;