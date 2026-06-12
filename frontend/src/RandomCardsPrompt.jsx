// src/components/RandomCards/RandomCards.js

import React, { useState, useEffect, useCallback } from 'react';
import './RandomCardsPrompt.css';
import cardsData from './cards.json';

const TOTAL_CARDS = 78; // Total number of cards in the deck
const CARDS_TO_DISPLAY = 3; // Number of cards to display

function getCardNumber(card) {
  return typeof card === 'number' ? card : card?.number;
}

function RandomCardsPrompt({ fade, selectedCards: selectedCardsProp, onShuffleCards, startTheSpread }) {
  const [fallbackSelectedCards, setFallbackSelectedCards] = useState([]);
  const hasParentCards = Array.isArray(selectedCardsProp);
  const selectedCards = hasParentCards ? selectedCardsProp : fallbackSelectedCards;

  // Function to generate three unique random numbers between 1 and TOTAL_CARDS
  const generateUniqueRandomNumbers = useCallback(() => {
    const numbers = new Set();
    while (numbers.size < CARDS_TO_DISPLAY) {
      const randomNum = Math.floor(Math.random() * TOTAL_CARDS) + 1;
      numbers.add(randomNum);
    }
    return Array.from(numbers);
  }, []);

  // Function to select three random cards
  const selectRandomCards = useCallback(() => {
    const randomNumbers = generateUniqueRandomNumbers();
    setFallbackSelectedCards(randomNumbers);
  }, [generateUniqueRandomNumbers]);

  // Select random cards on component mount
  useEffect(() => {
    if (!hasParentCards && fallbackSelectedCards.length === 0) {
      selectRandomCards();
    }
  }, [fallbackSelectedCards.length, hasParentCards, selectRandomCards]);

  // Helper function to get card data by number
  const getCardData = (cardNumber) => {
    return cardsData.find((card) => card.number === cardNumber);
  };

  const handleShuffleCards = () => {
    if (onShuffleCards) {
      onShuffleCards();
      return;
    }

    selectRandomCards();
  };

  return (
    <div className={`random-cards-container ${fade ? 'fade-in' : 'fade-out'}`}>
      <div className="cards-display">
        {selectedCards.slice(0, CARDS_TO_DISPLAY).map((card, index) => {
          const cardNumber = getCardNumber(card);
          const cardData = getCardData(cardNumber);

          return (
            <div className="one-card" key={`${cardNumber || 'card'}-${index}`}>
              {cardNumber && (
                <img
                  src={`/waite-deck/card${cardNumber}.jpg`}
                  alt={`${cardData?.name || `Card ${cardNumber}`}`}
                  className="card-image"
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Optional: Button to refresh the cards */}
      <button className="refresh-button" onClick={handleShuffleCards}>
        Shuffle Cards
      </button>
      <button className="refresh-button" onClick={startTheSpread}>
        Perform the Ceremony
      </button>
    </div>
  );
}

export default RandomCardsPrompt;
