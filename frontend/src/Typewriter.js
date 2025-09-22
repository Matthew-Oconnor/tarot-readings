// Typewriter.jsx
import React, { useEffect, useRef, useState } from 'react';
import './Typewriter.css';

const Typewriter = ({ text = '', speedRange = [5, 40], onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  const iRef = useRef(0);
  const tRef = useRef(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // keep latest callback without retriggering the typing effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    iRef.current = 0;
    doneRef.current = false;
    setDisplayed('');

    let cancelled = false;

    const step = () => {
      if (cancelled) return;

      if (iRef.current < text.length) {
        iRef.current += 1;
        setDisplayed(text.slice(0, iRef.current)); // derive prefix (no concat drift)

        const [min, max] = speedRange;
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        tRef.current = setTimeout(step, delay);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current?.();
      }
    };

    step();

    return () => {
      cancelled = true;
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [text, speedRange]); // ← no onComplete here

  return <p className="Typewriter-text">{displayed}</p>;
};

export default Typewriter;