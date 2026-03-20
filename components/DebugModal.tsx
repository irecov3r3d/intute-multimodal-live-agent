/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSessionStore } from '../lib/state';
import Modal from './Modal';
import { useUI } from '../lib/state';
import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { encodeWAV, getAudioDuration } from '../lib/utils';

// Retrieve the API key from the environment.
const API_KEY =
  typeof process !== 'undefined' && process.env
    ? (process.env.API_KEY as string)
    : undefined;

/**
 * Formats a number of bytes into a human-readable string (e.g., "1.2 KB").
 * This is used to display memory usage and file sizes in a user-friendly way.
 */
function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * DebugModal Component (Session Info)
 * 
 * This component provides a detailed view of the current learning session.
 * It allows users to view a word-for-word transcript, generate a summary of the lesson,
 * and listen to or download audio recordings of the conversation.
 */
export default function DebugModal() {
  // Access session data (transcript and audio logs) from the global store.
  const { transcript, audioLog } = useSessionStore();
  
  // Access UI state to control modal visibility and track teacher edits.
  const {
    setShowDebugModal,
    changeCount,
  } = useUI();

  // Local state for tab management and memory tracking.
  const [activeTab, setActiveTab] = useState('transcript');
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);

  // State for the AI-generated summary feature.
  const [correctedTranscript, setCorrectedTranscript] = useState('');
  const [isCorrectingTranscript, setIsCorrectingTranscript] = useState(false);
  
  // State for managing audio playback within the audio log tab.
  const [playingAudio, setPlayingAudio] = useState<{
    index: number;
    element: HTMLAudioElement;
    url: string;
  } | null>(null);


  /**
   * Effect: Memory Usage Polling
   * Periodically checks the browser's memory usage (if supported) to display in the header.
   */
  useEffect(() => {
    const memory = (performance as any).memory;
    if (!memory) return;

    const interval = setInterval(() => {
      setMemoryUsage(memory.usedJSHeapSize);
    }, 1000);
    setMemoryUsage(memory.usedJSHeapSize);

    return () => clearInterval(interval);
  }, []);

  /**
   * Generates a concise summary of the lesson transcript using the Gemini API.
   * This function sends the full transcript to the model and processes the Markdown response.
   */
  const handleGetMinutes = async () => {
    if (!API_KEY) return;
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    setIsCorrectingTranscript(true);
    setCorrectedTranscript('Generating summary...');
    const model = 'gemini-2.5-flash';
    const TIMEOUT_SECONDS = 20;

    try {
      // Prepare the transcript for the model.
      const fullTranscript = transcript
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');
      
      const prompt = `Please summarize the following lesson transcript into clear, concise minutes using Markdown. \n\nTranscript:\n\n${fullTranscript}`;
      
      // Implement a timeout to prevent the UI from hanging on long API calls.
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `The model call to ${model} has timed out after ${TIMEOUT_SECONDS} seconds.`
              )
            ),
          TIMEOUT_SECONDS * 1000
        )
      );

      // Race the API call against the timeout.
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
        }),
        timeoutPromise,
      ]);

      const corrected = (response as GenerateContentResponse).text;
      setCorrectedTranscript(corrected ?? 'Summary generation returned an empty response.');
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setCorrectedTranscript(
        `Sorry, an error occurred while generating the summary: ${error.message}`
      );
    } finally {
      setIsCorrectingTranscript(false);
    }
  };
  
  /**
   * Toggles playback for a specific audio clip in the audio log.
   * Handles creating and revoking object URLs to manage memory efficiently.
   */
  const toggleAudioPlayback = (index: number, blob: Blob) => {
    if (playingAudio && playingAudio.index === index) {
      // If the same clip is clicked, stop it.
      playingAudio.element.pause();
      URL.revokeObjectURL(playingAudio.url);
      setPlayingAudio(null);
    } else {
      // If a different clip is clicked, stop the current one and start the new one.
      if (playingAudio) {
        playingAudio.element.pause();
        URL.revokeObjectURL(playingAudio.url);
      }
      
      // Create a temporary URL for the audio blob.
      const url = URL.createObjectURL(encodeWAV(blob as any, 24000));
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio({ index, element: audio, url });
    }
  };

  /**
   * Combines all recorded audio clips into a single WAV file and triggers a download.
   */
  const handleSaveAudioLog = async () => {
    const blobs = audioLog.map(entry => entry.blob);
    const combinedBlob = new Blob(blobs);
    const arrayBuffer = await combinedBlob.arrayBuffer();
    const wavBlob = encodeWAV(arrayBuffer, 24000);
    const url = URL.createObjectURL(wavBlob);
    
    // Create a hidden link and click it to trigger the browser download.
    const a = document.createElement('a');
    a.href = url;
    a.download = `intute_audio_log_${new Date().toISOString()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal onClose={() => setShowDebugModal(false)} className="debug-modal-container">
      <div className="debug-modal">
        {/* Header: Title and Session Statistics */}
        <div className="debug-header">
          <div className="debug-header-top">
            <h2>Session Info</h2>
          </div>
          <div className="debug-stats">
            {memoryUsage !== null && <div className="stat-item"><strong>Memory:</strong> {formatBytes(memoryUsage)}</div>}
            {changeCount > 0 && (
              <div className="stat-item">
                <strong>Teacher Edits:</strong> {changeCount}
              </div>
            )}
          </div>
          
          {/* Navigation Tabs */}
          <div className="debug-tabs">
            <button
              onClick={() => setActiveTab('transcript')}
              className={activeTab === 'transcript' ? 'active' : ''}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveTab('minutes')}
              className={activeTab === 'minutes' ? 'active' : ''}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('audiolog')}
              className={activeTab === 'audiolog' ? 'active' : ''}
            >
              Audio Log
            </button>
          </div>
        </div>

        {/* Tab Content: Transcript View */}
        {activeTab === 'transcript' && (
            <div className="transcript-content" style={{ overflowY: 'auto', flexGrow: 1, padding: '16px' }}>
              {transcript.length > 0 ? (
                  transcript.map((entry, index) => (
                    <p key={index} className="transcript-entry" style={{ marginBottom: '12px' }}>
                      <strong style={{ color: 'var(--theme-accent)' }}>{entry.speaker}:</strong> {entry.text}
                    </p>
                  ))
              ) : (
                  <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No conversation yet.</p>
              )}
            </div>
        )}

        {/* Tab Content: Summary Generation View */}
        {activeTab === 'minutes' && (
            <div className="debug-log-container" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="debug-controls" style={{ padding: '16px', borderBottom: '1px solid #ccc' }}>
                    <button onClick={handleGetMinutes} className="button primary" disabled={transcript.length === 0 || isCorrectingTranscript}>
                        {isCorrectingTranscript ? 'Generating...' : 'Generate Summary'}
                    </button>
                </div>
                <div className="prose-view" style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
                     {correctedTranscript ? (
                         <div dangerouslySetInnerHTML={{ __html: marked.parse(correctedTranscript) }} />
                     ) : (
                         <p style={{ opacity: 0.6, fontStyle: 'italic' }}>Click generate to see a summary of the session.</p>
                     )}
                </div>
            </div>
        )}

        {/* Tab Content: Audio Log and Playback View */}
        {activeTab === 'audiolog' && (
            <div className="audio-log-view" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
              <div className="audio-log-controls" style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <button
                  onClick={handleSaveAudioLog}
                  disabled={audioLog.length === 0}
                  className="button"
                >
                  Download Complete Audio (WAV)
                </button>
              </div>
              <div className="audio-log-content" style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>
                <div className="audio-log-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontWeight: 'bold', marginBottom: '8px' }}>
                  <div>Timestamp</div>
                  <div>Speaker</div>
                  <div>Duration</div>
                  <div className="audio-log-playback" style={{ textAlign: 'right' }}>Playback</div>
                </div>
                {audioLog.length > 0 ? (
                  audioLog.map((entry, index) => (
                    <div key={index} className="audio-log-entry" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <div>{entry.timestamp.toLocaleTimeString()}</div>
                      <div>{entry.speaker}</div>
                      <div>{getAudioDuration(entry.blob)}</div>
                      <div className="audio-log-playback" style={{ textAlign: 'right' }}>
                        <button
                          className="play-audio-button"
                          onClick={() => toggleAudioPlayback(index, entry.blob)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-accent)' }}
                        >
                          <span className="icon">
                            {playingAudio?.index === index ? 'pause_circle' : 'play_circle'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="audio-log-empty" style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                    <p>No audio recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
        )}
      </div>
    </Modal>
  );
}
