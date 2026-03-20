/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Modal from './Modal';
import { useUI } from '../lib/state';

/**
 * HelpModal Component
 * 
 * This component renders a comprehensive help guide for the user in a modal window.
 * It provides detailed instructions on how to interact with the Intute learning assistant,
 * explaining core features like session setup, conversational learning, the lesson document,
 * and session information tools.
 */
export default function HelpModal() {
  // Access the UI state to control the visibility of the help modal.
  const { setShowHelpModal } = useUI();

  /**
   * Closes the help modal by updating the global UI state.
   */
  function onClose() {
    setShowHelpModal(false);
  }

  return (
    <Modal onClose={onClose} className="help-modal-container">
      <div className="help-modal-content">
        <h2 className="help-modal-title">How to Use Intute</h2>

        {/* Section 1: Initial Setup and Configuration */}
        <div className="help-section">
          <h3>Getting Started</h3>
          <p>
            Before you begin, it's a good idea to set up your session. Click the{' '}
            <strong>
              <span className="icon icon-in-text">tune</span>Settings
            </strong>{' '}
            button in the top-right corner to:
          </p>
          <ul>
            <li>
              <strong>Set your name:</strong> This helps the teacher refer to you
              correctly.
            </li>
            <li>
              <strong>Define the topic:</strong> Let the teacher know what you'd
              like to learn about (e.g., "photosynthesis," "the history of the
              Roman Empire").
            </li>
            <li>
              <strong>Add context:</strong> Provide any key details, such as your
              current knowledge level (e.g., "I'm a complete beginner").
            </li>
          </ul>
          <p>
            If you ever want to start over with a clean slate, click the{' '}
            <strong>
              <span className="icon icon-in-text">restart_alt</span>Reset
            </strong>{' '}
            button next to the teacher's name. This will clear the entire
            session, including the transcript and document, allowing you to
            begin a new lesson from scratch.
          </p>
        </div>

        {/* Section 2: Core Interaction Loop (Voice and Conversation) */}
        <div className="help-section">
          <h3>The Basics: Just Talk!</h3>
          <p>
            Intute is designed to be a conversation with your teacher. To start the
            lesson, click the large{' '}
            <strong>
              <span className="icon icon-in-text">play_arrow</span>Play button
            </strong>{' '}
            at the bottom of the screen. Your microphone will become active.
          </p>
          <ul>
            <li>
              <strong>Start Speaking:</strong> Ask a question or state what you want to
              learn. As you speak, the teacher will listen and begin preparing
              the lesson on the lesson document.
            </li>
            <li>
              <strong>Learn Step-by-Step:</strong> The teacher uses a "show, then
              tell" method. First, they will silently write notes, formulas, or
              diagrams on the lesson document. Then, they will verbally explain the
              concept and ask if you understand before moving on.
            </li>
            <li>
              <strong>Request Diagrams & Graphs:</strong> Ask your teacher to add a "diagram of..." or "plot a graph of..." to the lesson. They will generate visual aids or interactive plots to help you understand complex concepts.
            </li>
            <li>
              <strong>Mute/Unmute:</strong> You can click the{' '}
              <strong>
                <span className="icon icon-in-text">mic</span>Microphone button
              </strong>{' '}
              to mute or unmute yourself at any time.
            </li>
            <li>
              <strong>Pause Session:</strong> Click the{' '}
              <strong>
                <span className="icon icon-in-text">pause</span>Pause button
              </strong>{' '}
              to end the session.
            </li>
          </ul>
        </div>

        {/* Section 3: The Collaborative Document (Markdown/LaTeX) */}
        <div className="help-section">
          <h3>The Lesson Document</h3>
          <p>
            This is the main area where your lesson takes shape. The content is
            written in Markdown for clear readability, with LaTeX support for
            professional-grade math formulas.
          </p>
          <ul>
            <li>
              <strong>Lesson View:</strong> The default read-only mode. It shows a clean, formatted presentation of the lesson. From here, you can:
              <ul>
                <li style={{marginTop: '8px'}}><strong>Copy to Clipboard:</strong> Click the <span className="icon icon-in-text">content_copy</span> button to copy the entire lesson (including images) to your clipboard.</li>
                <li><strong>Download PDF:</strong> Click the <span className="icon icon-in-text">picture_as_pdf</span> button to save a high-quality PDF of the rendered lesson, including all visuals.</li>
              </ul>
            </li>
            <li>
              <strong>Editor View:</strong> Switch to this mode to type, delete, or rephrase anything. The teacher will see your changes and adapt. The toolbar in this view provides standard <strong>Undo/Redo/Clear</strong> controls.
            </li>
          </ul>
        </div>

        {/* Section 4: Session Information and Tools */}
        <div className="help-section">
          <h3>Session Info</h3>
          <p>
            Click the <strong><span className="icon icon-in-text">info</span> Info</strong> button 
            in the header to access session data:
          </p>
          <ul>
            <li>
              <strong>Transcript:</strong> A raw, word-for-word transcript of
              the conversation.
            </li>
            <li>
              <strong>Summary:</strong> Generate a concise summary (minutes) of your lesson.
            </li>
            <li>
              <strong>Audio Log:</strong> Listen back to individual audio clips
              or download the entire conversation.
            </li>
          </ul>
        </div>

        {/* Section 5: Teacher Customization */}
        <div className="help-section">
          <h3>Changing Your Teacher</h3>
          <p>
            You can change the AI teacher at any time. Click the{' '}
            <strong>Teacher's Name</strong> in the top-left corner to choose
            from a list of different teaching styles and languages.
          </p>
          <p>
            Each teacher has a unique personality and voice. We've recently added several new high-quality voices including <strong>Puck</strong>, <strong>Charon</strong>, <strong>Kore</strong>, <strong>Fenrir</strong>, and <strong>Zephyr</strong> to make your learning experience more natural and engaging. Our teachers also support multiple languages including Spanish, French, Hindi, and more!
          </p>
        </div>

        {/* Section 6: Visual Feedback (Avatar) */}
        <div className="help-section">
          <h3>The Floating Avatar</h3>
          <p>
            The floating circle is a visual indicator for the teacher. It will
            animate when the teacher is "thinking" or speaking. You can also
            click and drag it to move it anywhere you'd like on the screen.
          </p>
        </div>
      </div>
    </Modal>
  );
}
