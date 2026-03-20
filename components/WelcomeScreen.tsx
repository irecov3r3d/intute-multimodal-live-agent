/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useState } from 'react';
import { useUI } from '../lib/state';

const transliterations = [
  'Intute',
  'インテュート', // Japanese
  '인튜트', // Korean
  '英图特', // Chinese
  'Интуте', // Russian
  'إنتوت', // Arabic
  'אינטוט', // Hebrew
  'इंट्यूट', // Hindi
  'อินทูต', // Thai
  'Ιντούτε', // Greek
  'İntute', // Turkish
  'Интуи', // Ukrainian (variant)
  'ინტუტე', // Georgian
  'இன்ட்யூட்', // Tamil
  'ಇಂಟ್ಯೂಟ್', // Kannada
  'ഇൻട്യൂട്ട്', // Malayalam
  'انٹیوٹ', // Urdu
  'Інтют', // Ukrainian
  'Intūte', // Latvian
  'Интюте', // Bulgarian
];


/**
 * The initial welcome screen for the application. It provides a brief
 * overview of the app's features and a prominent button to start the
 * configuration process.
 */
export default function WelcomeScreen() {
  const { setShowWelcomeScreen } = useUI();
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Trigger the entrance animation shortly after the component mounts.
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Handles the action to close the welcome screen. It triggers an exit
   * animation and then proceeds directly to the main application.
   */
  async function handleClose() {
    setIsExiting(true);
    // Wait for the exit animation to complete before changing the UI state.
    setTimeout(() => {
      setShowWelcomeScreen(false);
    }, 800); // Wait for animation
  }

  return (
    <div
      className={`welcome-screen-shroud ${isVisible ? 'visible' : ''} ${
        isExiting ? 'exiting' : ''
      }`}
    >
      <div className="atmosphere" />
      <div className="floating-name-container">
        {transliterations.map((name, index) => (
          <div
            key={index}
            className="floating-name"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              fontSize: `${1 + Math.random() * 1.5}rem`,
              animationDelay: `${Math.random() * 30}s`,
              animationDuration: `${20 + Math.random() * 20}s`,
            }}
          >
            {name}
          </div>
        ))}
      </div>
      <div className="welcome-screen fancy-layout">
        <h1 className="welcome-title-fancy">Intute</h1>
        <p className="welcome-subtitle-fancy">Your live teaching assistant</p>

        <div className="powered-by-gemini">
          <svg
            className="gemini-star"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
              fill="currentColor"
            />
          </svg>
          <span>Powered by Gemini</span>
        </div>

        <button onClick={handleClose} className="teach-me-button">
          Start Learning
          <span className="material-symbols-outlined icon-right">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
