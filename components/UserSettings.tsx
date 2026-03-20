/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Modal from './Modal';
import { useAgent, useUI, useUser } from '../lib/state';

/**
 * A modal for configuring user settings for the learning session.
 * It features a modern, "jazzy" design for a more engaging user experience.
 */
export default function UserSettings() {
  // Hooks to manage user-specific data (name, info, topic, etc.)
  const { name, info, topic, setName, setInfo, setTopic } =
    useUser();
  // Hooks to manage UI state (modal visibility)
  const { setShowUserConfig } = useUI();
  // Hooks to manage agent state
  const { current: agent } = useAgent();

  /**
   * A placeholder function that currently just closes the modal.
   * Could be expanded in the future if client-side settings need more complex handling.
   */
  function updateClient() {
    setShowUserConfig(false);
  }

  const topicLabel = `What subject are we studying today, ${name || 'friend'}?`;
  const topicPlaceholder =
    'e.g., Photosynthesis, calculus, creative writing, the history of Rome...';

  return (
    <Modal onClose={() => setShowUserConfig(false)}>
      <div className="userSettings jazzy">
        <h2>Session Setup</h2>
        <p className="config-description">Tell your teacher about yourself and what you'd like to learn today.</p>

        <form
          onSubmit={e => {
            e.preventDefault();
            setShowUserConfig(false);
            updateClient();
          }}
        >
          <div>
            <p>Your name</p>
            <input
              type="text"
              name="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="What do you like to be called?"
            />
          </div>

          <div>
            <p>{topicLabel}</p>
            <input
              type="text"
              name="topic"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={topicPlaceholder}
            />
          </div>

          <details>
            <summary>Context (Optional)</summary>
            <div className="details-content">
              <p className="context-description">
                Provide any background info worth knowing for this session.
              </p>
              <textarea
                rows={5}
                name="info"
                value={info}
                onChange={e => setInfo(e.target.value)}
                placeholder="e.g., 'I'm a beginner at this', 'Focus on the main concepts', etc."
              />
            </div>
          </details>

          <button className="button primary">Start Learning!</button>
        </form>
      </div>
    </Modal>
  );
}