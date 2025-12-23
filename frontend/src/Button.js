import React from 'react';
import './Button.css'; // Import corresponding CSS

const Button = ({ onClick, children, fade }) => {
  
  return (
    <button
      className={`Welcome-button ${fade ? 'fade-in' : 'fade-out'}`}
      onClick={onClick}
      aria-label="Welcome Button"
    >
      {children}
    </button>
  );
};

export default Button;
