// src/components/RandomCards/RandomCards.js

import React, { useState, useEffect } from 'react';
import './RandomCardsPrompt.css';
import cardsData from './cards.json';

const TOTAL_CARDS = 78; // Total number of cards in the deck
const CARDS_TO_DISPLAY = 3; // Number of cards to display

function RandomCardsPrompt({ fade, startTheSpread }) { // Accept fade prop
  const [selectedCards, setSelectedCards] = useState([]);

  // Function to generate three unique random numbers between 1 and TOTAL_CARDS
  const generateUniqueRandomNumbers = () => {
    const numbers = new Set();
    while (numbers.size < CARDS_TO_DISPLAY) {
      const randomNum = Math.floor(Math.random() * TOTAL_CARDS) + 1;
      numbers.add(randomNum);
    }
    return Array.from(numbers);
  };

  // Function to select three random cards
  const selectRandomCards = () => {
    const randomNumbers = generateUniqueRandomNumbers();
    setSelectedCards(randomNumbers);
  };

  // Select random cards on component mount
  useEffect(() => {
    selectRandomCards();
  }, []);

  // Helper function to get card data by number
  const getCardData = (cardNumber) => {
    return cardsData.find((card) => card.number === cardNumber);
  };

  return (
    <div className={`random-cards-container ${fade ? 'fade-in' : 'fade-out'}`}>
      <div className="cards-display">
        <div className="one-card">
          {selectedCards[0] && (
            <img
              src={`/waite-deck/card${selectedCards[0]}.jpg`}
              alt={`${getCardData(selectedCards[0]).name}`}
              className="card-image"
            />
          )}
        </div>
        <div className="one-card">
          {selectedCards[1] && (
            <img
              src={`/waite-deck/card${selectedCards[1]}.jpg`}
              alt={`${getCardData(selectedCards[1]).name}`}
              className="card-image"
            />
          )}
        </div>
        <div className="one-card">
          {selectedCards[2] && (
            <img
              src={`/waite-deck/card${selectedCards[2]}.jpg`}
              alt={`${getCardData(selectedCards[2]).name}`}
              className="card-image"
            />
          )}
        </div>
      </div>
      {/* Optional: Button to refresh the cards */}
      <button className="refresh-button" onClick={selectRandomCards}>
        Shuffle Cards
      </button>
      <button className="refresh-button" onClick={startTheSpread}>
        Perform the Ceremony
      </button>
    </div>
  );
}

export default RandomCardsPrompt;
