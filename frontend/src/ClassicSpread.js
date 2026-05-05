import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ClassicSpread.css';
import cardsData from './cards.json';
import ResponseContainer from './ResponseContainer';
import { streamText } from './streamText';

const TOTAL_CARDS = 78; // Total number of cards in the deck
const CARDS_TO_DISPLAY = 3; // Number of cards to display

const ClassicSpread = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [isResponseStreaming, setIsResponseStreaming] = useState(false);
  const [showReturnButton, setshowReturnButton] = useState(false); // State to control button visibility
  const streamAbortRef = useRef(null);

  const generateUniqueRandomCards = useCallback(() => {
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
  }, []);

  const selectRandomCards = useCallback(() => {
    streamAbortRef.current?.abort();
    const randomCards = generateUniqueRandomCards();
    setSelectedCards(randomCards);
    setResponseText(''); // Clear previous response when reshuffling
    setIsResponseStreaming(false);
    setshowReturnButton(false); // Hide the button when reshuffling
  }, [generateUniqueRandomCards]);

  useEffect(() => {
    const fadeInTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Delay to ensure the transition occurs

    selectRandomCards();

    return () => {
      clearTimeout(fadeInTimeout);
      streamAbortRef.current?.abort();
    };
  }, [selectRandomCards]);

  const getCardData = (cardNumber) => {
    return cardsData.find((card) => card.number === cardNumber);
  };

  const generateSpreadInterpretation = useCallback(async () => {
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setResponseText('');
    setIsResponseStreaming(true);
    setshowReturnButton(false);

    try {
      await streamText('/api/psychic/spread/stream', {
        body: { cards: selectedCards },
        signal: controller.signal,
        onChunk: (_chunk, fullText) => {
          setResponseText(fullText);
        },
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Error fetching reading:', error?.message);
      setResponseText('An error occurred while discussing the spread.');
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
        setIsResponseStreaming(false);
      }
    }
  }, [selectedCards]);

  useEffect(() => {
    if (selectedCards.length === CARDS_TO_DISPLAY) {
      generateSpreadInterpretation();
    }
  }, [generateSpreadInterpretation, selectedCards]);

  // Callback for when typing is complete
  const handleTypingComplete = () => {
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
        isStreaming={isResponseStreaming}
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
