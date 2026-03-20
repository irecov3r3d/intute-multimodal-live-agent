/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef } from 'react';
import {
  Agent,
  INTERLOCUTOR_VOICE,
  INTERLOCUTOR_VOICES,
} from '../lib/presets/agents';
import Modal from './Modal';
import { useAgent, useUI } from '../lib/state';

/**
 * A modal component for editing the properties of the currently active agent.
 * It allows changing the agent's name, personality prompt, and voice in a
 * streamlined, text-focused interface.
 */
export default function EditAgent() {
  // Fetches the current agent's data and the function to update it from the Zustand store.
  const agent = useAgent(state => state.current);
  const updateAgent = useAgent(state => state.update);
  const nameInput = useRef(null);
  // Fetches the function to control the visibility of this modal from the UI store.
  const { setShowAgentEdit } = useUI();

  /**
   * Closes the agent editing modal.
   */
  function onClose() {
    setShowAgentEdit(false);
  }

  /**
   * A helper function to update the current agent's properties.
   * @param adjustments A partial object of the Agent type containing the fields to update.
   */
  function updateCurrentAgent(adjustments: Partial<Agent>) {
    updateAgent(agent.id, adjustments);
  }

  return (
    <Modal onClose={() => onClose()} className="agent-edit-modal">
      <form
        className="edit-agent-form"
        onSubmit={e => {
          e.preventDefault();
          onClose();
        }}
      >
        <div className="agent-edit-header">
          <div className="config-field name-field">
            <label>Name</label>
            <input
              type="text"
              placeholder="Name"
              value={agent.name}
              onChange={e => updateCurrentAgent({ name: e.target.value })}
              ref={nameInput}
              className="header-input"
            />
          </div>
          <div className="config-field voice-field">
            <label>Voice</label>
            <select
              value={agent.voice}
              onChange={e => {
                updateCurrentAgent({
                  voice: e.target.value as INTERLOCUTOR_VOICE,
                });
              }}
              className="header-input"
            >
              {INTERLOCUTOR_VOICES.map(voice => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="button primary done-button">
            Done
          </button>
        </div>

        <div className="agent-personality">
          <label>Personality</label>
          <textarea
            value={agent.personality}
            onChange={e => updateCurrentAgent({ personality: e.target.value })}
            placeholder="How should this assistant act? What is its purpose?"
          />
        </div>
      </form>
    </Modal>
  );
}