/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { Agent } from '../lib/presets/agents';
import { useAgent, useUI, useUser, useSessionStore, useInsertStore, usePerfLogStore } from '../lib/state';
import c from 'classnames';

/**
 * The main header component for the application. It displays the current
 * agent's name, provides a dropdown to switch between agents, and contains
 * controls for accessing user settings, the debug log, and help.
 */
export default function Header() {
  const {
    showUserConfig,
    setShowUserConfig,
    setShowDebugModal,
    setShowAgentEdit,
    setShowHelpModal,
    theme,
    setTheme,
    documentMode,
    setDocumentMode,
  } = useUI();
  const { name } = useUser();
  const { current, setCurrent, availablePresets } = useAgent();
  const { disconnect } = useLiveAPIContext();
  const { transcript, documentContent } = useSessionStore();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // State to manage the visibility of the agent selection dropdown.
  const [showRoomList, setShowRoomList] = useState(false);
  
  const isDarkMode = theme === 'Dark Theme';

  const hasContent = transcript.length > 0 || (documentContent && documentContent !== 'As you talk, your teacher will update the lesson notes here...');

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingReset(true);
  };

  const handleConfirmReset = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Disconnect the Live API session.
    disconnect();

    // 2. Reset all relevant Zustand stores to their initial states.
    useUser.getState().reset();
    useAgent.getState().reset();
    useUI.getState().reset();
    useSessionStore.getState().clearSession();
    useInsertStore.getState().clearInserts();
    usePerfLogStore.getState().clearLogs();

    // 3. Reset local component state.
    setShowRoomList(false);
    setIsConfirmingReset(false);
  };

  const handleCancelReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingReset(false);
  };

  // This effect adds a global click listener to close the dropdowns
  // when the user clicks anywhere else on the page.
  useEffect(() => {
    const closeDropdowns = () => {
      setShowRoomList(false);
      setIsConfirmingReset(false);
    };
    addEventListener('click', closeDropdowns);
    return () => removeEventListener('click', closeDropdowns);
  }, []);

  /**
   * Handles changing the current agent. It first disconnects the active
   * Live API session before setting the new agent to ensure a clean state change.
   * @param agent The agent object or ID to switch to.
   */
  function changeAgent(agent: Agent | string) {
    disconnect();
    setCurrent(agent);
  }

  return (
    <header>
      <div className="roomInfo">
        <div className="roomName">
          <button
            onClick={e => {
              e.stopPropagation();
              setShowRoomList(!showRoomList);
            }}
          >
            <h1 className={c({ active: showRoomList })}>
              {current.name}
              {/* The "Edit Agent" button is a special feature, conditionally shown. */}
              {name === 'Krishna' && (
                <span
                  className="icon edit-agent-icon"
                  onClick={e => {
                    e.stopPropagation();
                    setShowAgentEdit(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowAgentEdit(true);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title="Edit agent"
                >
                  edit
                </span>
              )}
              <span className="icon">arrow_drop_down</span>
            </h1>
          </button>
        </div>

        {hasContent && (
          <div className="reset-container">
            {!isConfirmingReset ? (
              <button
                className="reset-button"
                onClick={handleResetClick}
                title="Start over"
              >
                <span className="icon">restart_alt</span>
              </button>
            ) : (
              <div className="reset-confirm-actions">
                <button 
                  className="reset-button confirm" 
                  onClick={handleConfirmReset} 
                  title="Confirm Reset"
                >
                  <span className="icon">check</span>
                </button>
                <button 
                  className="reset-button cancel" 
                  onClick={handleCancelReset} 
                  title="Cancel"
                >
                  <span className="icon">close</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* The agent selection dropdown list */}
        <div className={c('roomList', { active: showRoomList })}>
          <div>
            <ul>
              {availablePresets
                .filter(agent => agent.id !== current.id)
                .map(agent => (
                  <li
                    key={agent.name}
                    className={c({ active: agent.id === current.id })}
                  >
                    <button onClick={() => changeAgent(agent)}>
                      {agent.name}
                      {agent.languageLabel && ` (${agent.languageLabel})`}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      {/* CENTRAL MODE TOGGLE */}
      <div className="view-mode-toggles">
        <button
          className={c({ active: documentMode === 'rendered' })}
          onClick={() => setDocumentMode('rendered')}
          title="Lesson View (Read Only)"
        >
          <span
            className="icon"
            style={{ fontSize: '20px', marginRight: '4px' }}
          >
            visibility
          </span>
          Lesson
        </button>
        <button 
          className={c({ active: documentMode === 'editor' })}
          onClick={() => setDocumentMode('editor')}
          title="Editor View (Write)"
        >
          <span className="icon" style={{ fontSize: '20px', marginRight: '4px' }}>edit</span>
          Editor
        </button>
      </div>

      <div className="header-controls">
        <button
          className="userSettingsButton"
          onClick={() => setShowDebugModal(true)}
          title="Session Info"
        >
          <span className="icon">info</span>
        </button>
        
        <button
          className="userSettingsButton"
          onClick={() => setShowUserConfig(!showUserConfig)}
          title="Session Setup"
        >
          <span className="icon">tune</span>
        </button>
      </div>
    </header>
  );
}