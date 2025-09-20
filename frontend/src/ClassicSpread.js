import React, { useState, useEffect } from 'react';
import './ClassicSpread.css';
import cardsData from './cards.json';
import axios from 'axios';
import ResponseContainer from './ResponseContainer';

const TOTAL_CARDS = 78; // Total number of cards in the deck
const CARDS_TO_DISPLAY = 3; // Number of cards to display

const ClassicSpread = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [showReturnButton, setshowReturnButton] = useState(false); // State to control button visibility

  const generateUniqueRandomCards = () => {
    const numbers = new Set();
    const cards = [];
  
    while (numbers.size < CARDS_TO_DISPLAY) {
      const randomNum = Math.floor(Math.random() * TOTAL_CARDS) + 1;
  
      if (!numbers.has(randomNum)) {
        numbers.add(randomNum);
        cards.push({
          number: randomNum,
          inverted: Math.random() < 0.5, // Randomly set to true or false
        });
      }
    }
  
    return cards;
  };

  const selectRandomCards = () => {
    const randomCards = generateUniqueRandomCards();
    setSelectedCards(randomCards);
    setResponseText(''); // Clear previous response when reshuffling
    setshowReturnButton(false); // Hide the button when reshuffling
  };

  useEffect(() => {
    const fadeInTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Delay to ensure the transition occurs

    selectRandomCards();

    return () => clearTimeout(fadeInTimeout);
  }, []);

  const getCardData = (cardNumber) => {
    return cardsData.find((card) => card.number === cardNumber);
  };

  const generateSpreadInterpretation = async () => {
    try {
      const res = await axios.post('/api/psychic/spread', {
        cards: selectedCards,
      });
      setResponseText(res.data.response);
    } catch (error) {
      console.error('Error fetching reading:', error?.message);
      setResponseText('An error occurred while discussing the spread.');
    }
  };

  useEffect(() => {
    if (selectedCards.length === CARDS_TO_DISPLAY) {
      generateSpreadInterpretation();
    }
  }, [selectedCards]);

  // Callback for when typing is complete
  const handleTypingComplete = () => {
    console.log("classic-spread is handling")
    setshowReturnButton(true); // Show the button when typing is done
  };

  return (
    <div className={`classic-spread-container ${isVisible ? 'fade-in' : 'fade-out'}`}>
      {/* Spread Cards */}
      <div className="spread-cards">
        {selectedCards.map((card, index) => (
          <div className="spread-card" key={index}>
            <h3>{['The Past', 'The Present', 'The Future'][index]}</h3>
            {card && (
              <img
                src={`/waite-deck/card${card.number}.jpg`}
                alt={`${getCardData(card.number)?.name || 'Unknown Card'}: ${
                  getCardData(card.number)?.description || ''
                }`}
                className={`card-image ${card.inverted ? 'inverted' : ''}`}
                style={{ transform: card.inverted ? 'rotate(180deg)' : 'none' }}
              />
            )}
          </div>
        ))}
      </div>
      {/* Spread Response */}
      <ResponseContainer
        text={responseText}
        fade={isVisible}
        onTypingComplete={handleTypingComplete}
      />
      {/* Render button when showReturnButton is true */}
      {showReturnButton && (
        <button
          className="reshuffle-button"
          onClick={selectRandomCards}
          style={{ position: 'absolute', right: '20px', top: '50%' }}
        >
          Give me a new reading!
        </button>
      )}
    </div>
  );
};

export default ClassicSpread;
