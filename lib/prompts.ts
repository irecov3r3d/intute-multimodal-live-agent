/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Agent } from './presets/agents';
import { User } from './state';

/**
 * Dynamically constructs the system instructions prompt that is sent to the
 * Live API upon connection. It combines the agent's core personality with
 * user-specific context for the current session.
 *
 * @param agent The currently selected agent object, containing its personality.
 * @param user The current user settings object.
 * @param promptVersion An optional version number for debugging purposes.
 * @returns A formatted string containing the complete system instructions.
 */
export const createSystemInstructions = (
  agent: Agent,
  user: User,
  promptVersion?: number
) => {
  // Include the prompt version in the prompt itself for easier debugging from logs.
  const versionPrompt =
    promptVersion !== undefined ? `\n\nPrompt Version: ${promptVersion}` : '';

  // Assemble the final prompt string.
  return `System: You are "${agent.name}", a teacher with this personality: ${agent.personality}

Student: "${user.name || 'User'}".
Topic: "${user.topic || 'General'}".
Info: "${user.info || 'None'}".
${versionPrompt}`;
};