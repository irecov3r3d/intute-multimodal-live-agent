/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import AgentEdit from './components/AgentEdit';
import ControlTray from './components/console/control-tray/ControlTray';
import DebugModal from './components/DebugModal';
import ErrorScreen from './components/demo/ErrorScreen';
import KeynoteCompanion from './components/demo/keynote-companion/KeynoteCompanion';
import Header from './components/Header';
import UserSettings from './components/UserSettings';
import WelcomeScreen from './components/WelcomeScreen';
import { LiveAPIProvider, useLiveAPIContext } from './contexts/LiveAPIContext';
import { useAgent, useUI } from './lib/state';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import LegalDisclaimer from './components/LegalDisclaimer';
import { themes } from './lib/themes';
import BasicFace from './components/demo/basic-face/BasicFace';
import cn from 'classnames';
import FloatingControls from './components/FloatingControls';
import HelpModal from './components/HelpModal';

const API_KEY =
  typeof process !== 'undefined' && process.env
    ? (process.env.API_KEY as string)
    : undefined;

// Minimum volume level that indicates audio output is occurring.
// This threshold prevents the avatar from reacting to negligible noise.
const AUDIO_OUTPUT_DETECTION_THRESHOLD = 0.05;

// Amount of delay in milliseconds after audio output stops before the avatar
// is considered "not talking". This creates a more natural-looking effect,
// preventing the talking animation from stopping abruptly between words.
const TALKING_STATE_COOLDOWN_MS = 2000;

/**
 * Renders the main content of the application, including the header, modals,
 * the draggable agent avatar, the primary app area (KeynoteCompanion), and the control tray.
 */
function AppContent() {
  const {
    showUserConfig,
    showAgentEdit,
    showDebugModal,
    showHelpModal,
    showWelcomeScreen,
    agentState,
    resetCounter,
  } = useUI();

  const { volume, connected, isConnecting } = useLiveAPIContext();
  const { current: agent } = useAgent();
  const [isTalking, setIsTalking] = useState(false);
  const [showLegalDisclaimer, setShowLegalDisclaimer] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceContainerRef = useRef<HTMLDivElement>(null);

  // State for the avatar's position and drag status.
  const [position, setPosition] = useState({ x: 0, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [networkQuality, setNetworkQuality] = useState('good'); // 'good', 'fair', 'poor'

  useEffect(() => {
    const connection = (navigator as any).connection;
    if (connection) {
      const updateQuality = () => {
        const type = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
        if (type === '4g') setNetworkQuality('good');
        else if (type === '3g') setNetworkQuality('fair');
        else setNetworkQuality('poor');
      };
      connection.addEventListener('change', updateQuality);
      updateQuality();
      return () => connection.removeEventListener('change', updateQuality);
    }
  }, []);

  const getNetworkColor = () => {
    if (networkQuality === 'good') return '#34a853'; // Green
    if (networkQuality === 'fair') return '#fbbc05'; // Yellow
    return '#d93025'; // Red
  };

  // Calculate the display status for the avatar overlay.
  let statusText = '';
  if (isConnecting) {
    statusText = 'Connecting';
  } else if (!connected) {
    statusText = 'Inactive';
  } else if (agentState) {
    statusText = agentState;
  } else if (isTalking) {
    statusText = 'Speaking';
  } else {
    statusText = 'Listening';
  }

  // Set the initial centered position of the avatar once the component mounts.
  useEffect(() => {
    if (faceContainerRef.current) {
      const containerWidth = faceContainerRef.current.offsetWidth;
      setPosition({
        x: window.innerWidth / 2 - containerWidth / 2,
        y: 10,
      });
    }
  }, []); // Run only once on mount

  // This effect ensures the avatar is repositioned to a safe, visible location
  // if a window resize causes it to go off-screen.
  useEffect(() => {
    const handleResize = () => {
      if (faceContainerRef.current) {
        const avatarWidth = faceContainerRef.current.offsetWidth;
        const avatarHeight = faceContainerRef.current.offsetHeight;

        setPosition(currentPosition => {
          // Check if any part of the avatar is outside the viewport.
          if (
            currentPosition.x < 0 ||
            currentPosition.y < 0 ||
            currentPosition.x + avatarWidth > window.innerWidth ||
            currentPosition.y + avatarHeight > window.innerHeight
          ) {
            // If it's off-screen, reset it to the default top-center position.
            return {
              x: window.innerWidth / 2 - avatarWidth / 2,
              y: 10,
            };
          }
          // Otherwise, maintain its current position.
          return currentPosition;
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array ensures this effect runs only once to attach/detach the listener.

  /**
   * Initiates a drag operation. It captures the initial mouse position
   * relative to the avatar's top-left corner to ensure smooth dragging.
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (faceContainerRef.current) {
      // Prevent drag from starting on right-click or middle-click.
      if (e.button !== 0) return;

      setIsDragging(true);
      const rect = faceContainerRef.current.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      // Prevent text selection on the page while dragging the avatar.
      e.preventDefault();
    }
  }, []);

  /**
   * Handles the mouse movement during a drag, updating the avatar's position.
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        // Prevent other default browser actions during drag (e.g., image ghosting).
        e.preventDefault();

        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        setPosition({ x: newX, y: newY });
      }
    },
    [isDragging]
  );

  /**
   * Ends the drag operation when the mouse button is released.
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Initiates a drag operation via touch.
   */
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (faceContainerRef.current) {
      setIsDragging(true);
      const rect = faceContainerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      dragOffsetRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
  }, []);

  /**
   * Handles the touch movement during a drag, updating the avatar's position.
   */
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isDragging) {
        // Prevent scrolling while dragging the avatar.
        e.preventDefault();

        const touch = e.touches[0];
        const newX = touch.clientX - dragOffsetRef.current.x;
        const newY = touch.clientY - dragOffsetRef.current.y;
        setPosition({ x: newX, y: newY });
      }
    },
    [isDragging]
  );

  /**
   * Ends the drag operation when the touch ends.
   */
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attaches and cleans up global event listeners for dragging.
  // This is necessary because the mouse might move outside the avatar's bounds
  // during a drag, and we still need to track its movement.
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none'; // Disable text selection globally.
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      document.body.style.userSelect = ''; // Re-enable text selection.
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // This effect detects whether the agent is "talking" based on the audio
  // output volume provided by the LiveAPIContext.
  useEffect(() => {
    if (volume > AUDIO_OUTPUT_DETECTION_THRESHOLD) {
      setIsTalking(true);
      // If audio is detected, clear any pending timeout that would set talking to false.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Set a new timeout. After the audio stops, there will be a cooldown period
      // before the talking state is set to false, making the animation feel more natural.
      timeoutRef.current = setTimeout(
        () => setIsTalking(false),
        TALKING_STATE_COOLDOWN_MS
      );
    }
  }, [volume]);

  const handleAcknowledge = () => {
    setShowLegalDisclaimer(false);
  };

  return (
    <>
      <div className="atmosphere" />
      <ErrorScreen />
      {showWelcomeScreen && <WelcomeScreen />}
      {!showWelcomeScreen && showLegalDisclaimer && (
        <LegalDisclaimer onAcknowledge={handleAcknowledge} />
      )}
      <Header />

      {/* Conditionally render modals based on UI state */}
      {showUserConfig && <UserSettings />}
      {showAgentEdit && <AgentEdit />}
      {showDebugModal && <DebugModal />}
      {showHelpModal && <HelpModal />}
      <FloatingControls />
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>
      <div className="streaming-console">
        <div
          ref={faceContainerRef}
          className={cn('basic-face-container-top', {
            talking: isTalking,
            dragging: isDragging,
          })}
          style={{
            top: `${position.y}px`,
            left: `${position.x}px`,
            filter: 'url(#goo)',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <BasicFace
            canvasRef={faceCanvasRef}
            color={getNetworkColor()}
            radius={50}
            isTalking={isTalking}
          />
          <div className="face-status-label">{statusText}</div>
        </div>
        <main>
          <div className="main-app-area">
            <KeynoteCompanion key={resetCounter} />
          </div>

          <ControlTray></ControlTray>
        </main>
      </div>
    </>
  );
}

/**
 * Main application component. It checks for the required API key, sets up the
 * global theme, and provides the LiveAPI context to its children.
 *
 * Architecture Overview:
 * - <LiveAPIProvider>: Manages the WebSocket connection to the Gemini Live API.
 * - <AppContent>: The main UI layout.
 *   - <Header>: Top navigation and user/agent settings.
 *   - <ControlTray>: Bottom controls for microphone and connection status.
 *   - <KeynoteCompanion>: The core interactive workspace where the lesson happens.
 *     - Handles the document state (Markdown/HTML).
 *     - Manages the conversation transcript.
 *     - Executes tool calls (updateDocument, insertIllustration, etc.).
 *   - <BasicFace>: The visual avatar that animates based on audio volume.
 */
function App() {
  // An API key is required. If it's missing, render an error message.
  if (!API_KEY) {
    return (
      <div className="fullscreen-error">
        <h1>Configuration Error</h1>
        <p>
          Missing required environment variable: <code>API_KEY</code>.
        </p>
        <p>Please ensure it is configured in your environment to run the app.</p>
      </div>
    );
  }

  const { theme } = useUI();

  // This effect applies the selected theme's colors as CSS variables to the root element,
  // allowing for dynamic theming of the entire application.
  useEffect(() => {
    const selectedTheme = themes.find(t => t.name === theme) || themes[0];
    const root = document.documentElement;
    root.style.setProperty('--theme-bg', selectedTheme.colors[0]);
    root.style.setProperty('--theme-surface', selectedTheme.colors[1]);
    root.style.setProperty('--theme-accent', selectedTheme.colors[2]);
    root.style.setProperty('--theme-text', selectedTheme.colors[3]);
    root.style.setProperty('--theme-document-bg', selectedTheme.colors[4]);
  }, [theme]);

  return (
    <div className="App">
      <LiveAPIProvider apiKey={API_KEY}>
        <AppContent />
      </LiveAPIProvider>
    </div>
  );
}

export default App;