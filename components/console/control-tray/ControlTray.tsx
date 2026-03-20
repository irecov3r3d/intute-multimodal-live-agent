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
 * See the License for the apecific language governing permissions and
 * limitations under the License.
 */

import cn from 'classnames';

import React, { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { usePerfLogStore, useUI } from '../../../lib/state';

export type ControlTrayProps = {
  children?: ReactNode;
};

// Minimum volume level that indicates user audio input is occurring.
const USER_AUDIO_INPUT_DETECTION_THRESHOLD = 0.01;

// Amount of delay in milliseconds after user audio input stops before the
// user is considered "not speaking".
const USER_TALKING_STATE_COOLDOWN_MS = 1500;

/**
 * The main control bar at the bottom of the screen, containing the
 * connect/disconnect button and microphone mute toggle.
 */
function ControlTray({ children }: ControlTrayProps) {
  // A single instance of AudioRecorder is created and managed for the component's lifecycle.
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const userSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const firstAudioChunkSentRef = useRef(false);

  const { showAgentEdit, showUserConfig } = useUI();
  const { addLog: addPerfLog, startNewSession } = usePerfLogStore();
  const { client, connected, connect, disconnect, isConnecting } = useLiveAPIContext();

  // Reset the "first audio chunk sent" flag on disconnect to prepare for the next session.
  useEffect(() => {
    if (!connected && !isConnecting) {
      firstAudioChunkSentRef.current = false;
    }
  }, [connected, isConnecting]);

  // This effect detects whether the user is speaking based on the microphone input volume.
  useEffect(() => {
    const onVolume = (volume: number) => {
      if (volume > USER_AUDIO_INPUT_DETECTION_THRESHOLD) {
        setIsUserSpeaking(true);
        if (userSpeakingTimeoutRef.current) {
          clearTimeout(userSpeakingTimeoutRef.current);
        }
        userSpeakingTimeoutRef.current = setTimeout(
          () => setIsUserSpeaking(false),
          USER_TALKING_STATE_COOLDOWN_MS,
        );
      }
    };

    audioRecorder.on('volume', onVolume);
    return () => {
      audioRecorder.off('volume', onVolume);
    };
  }, [audioRecorder]);

  // This effect ensures that the agent is disconnected if the user opens
  // the agent editor or user configuration modals, preventing unexpected
  // behavior while settings are being changed.
  useEffect(() => {
    if (showAgentEdit || showUserConfig) {
      if (connected) disconnect();
    }
  }, [showUserConfig, showAgentEdit, connected, disconnect]);

  // Automatically focuses the connect ('Play') button when the app is
  // in a disconnected state, providing a clear visual cue to the user.
  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  // This is the core effect for managing the audio input pipeline.
  // It starts or stops the AudioRecorder based on the connection status and mute state.
  useEffect(() => {
    // The 'data' event from the AudioRecorder contains base64-encoded PCM audio.
    const onData = (base64: string) => {
      // Log the first audio chunk sent for performance analysis.
      if (!firstAudioChunkSentRef.current) {
        addPerfLog({ turn: 0, event: 'User Audio: First Chunk Sent', details: { size: base64.length } });
        firstAudioChunkSentRef.current = true;
      }

      client.sendRealtimeInput({
        media: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      });
    };

    // If we are connected, NOT connecting, and not muted, start recording and stream the data.
    if (connected && !isConnecting && !muted && audioRecorder) {
      addPerfLog({ turn: 0, event: 'Audio Recorder: Started' });
      audioRecorder.on('data', onData);
      audioRecorder.start();
    } else {
      // Otherwise, ensure the recorder is stopped.
      audioRecorder.stop();
    }

    // Cleanup function to remove the event listener when the component unmounts
    // or when the dependencies change, preventing memory leaks.
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, isConnecting, client, muted, audioRecorder, addPerfLog]);

  return (
    <section className="control-tray">
      <div className={cn('button-group')}>
        <button
          className={cn('action-button mic-button', {
            talking: isUserSpeaking && !muted && connected && !isConnecting,
          })}
          onClick={() => setMuted(!muted)}
          disabled={!connected || isConnecting}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>
        {children}

        <div className={cn('connection-button-container', { connected: connected || isConnecting })}>
          {isUserSpeaking && !connected && !isConnecting && (
            <span className="agent-off-indicator">The agent is not on</span>
          )}
          <button
            ref={connectButtonRef}
            className={cn('action-button connect-toggle', { connected: connected && !isConnecting })}
            onClick={() => {
              if (connected) {
                disconnect();
              } else {
                startNewSession(); // Start a new session for performance logging.
                addPerfLog({ turn: 0, event: 'User Action: Connect Clicked' });
                connect();
              }
            }}
            disabled={isConnecting}
          >
            <span className="material-symbols-outlined filled">
              {isConnecting ? 'sync' : connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <span className="text-indicator">{isConnecting ? 'Connecting' : 'Streaming'}</span>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);