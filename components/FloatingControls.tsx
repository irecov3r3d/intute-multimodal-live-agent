/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { useUI } from '../lib/state';

export default function FloatingControls() {
  const { setShowHelpModal, theme, setTheme } = useUI();
  const isDarkMode = theme === 'Dark Theme';

  return (
    <div className="floating-controls">
      <button
        className="theme-toggle-button"
        onClick={() => setTheme(isDarkMode ? 'Light Theme' : 'Dark Theme')}
        title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      >
        <span className="icon">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
      </button>
      <button
        className="help-button"
        onClick={() => setShowHelpModal(true)}
        title="Help"
      >
        <span className="icon">help</span>
      </button>
    </div>
  );
}
