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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants';
import { usePerfLogStore } from '../../lib/state';

/**
 * The shape of the object returned by the `useLiveApi` hook.
 * It provides access to the API client, its configuration, connection state,
 * and control functions.
 */
export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;
  isConnecting: boolean;
  stopAudio: () => void;
  volume: number;
  resetConnection: () => void;
};

/**
 * A comprehensive hook for managing the entire lifecycle of a GenAI Live API connection.
 * It encapsulates the client initialization, audio streaming setup, connection management,
 * and event handling.
 *
 * @param apiKey The Google AI API key.
 * @param model The specific model to use for the connection.
 * @returns An object containing the client instance, state, and control functions.
 */
export function useLiveApi({
  apiKey,
  model = DEFAULT_LIVE_API_MODEL,
}: {
  apiKey: string;
  model?: string;
}): UseLiveApiResults {
  const client = useMemo(
    () => new GenAILiveClient(apiKey, model),
    [apiKey, model]
  );

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const { addLog: addPerfLog } = usePerfLogStore();

  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .catch(err => {
            console.error('Error adding volume meter worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      addPerfLog({ turn: 0, event: 'Live API: WebSocket Opened' });
      setIsConnecting(true);
    };
    const onClose = () => {
      setConnected(false);
      setIsConnecting(false);
    };
    const onSetupComplete = () => {
      addPerfLog({ turn: 0, event: 'Live API: Setup Complete' });
      setConnected(true);
    };
    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) => {
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));
    };

    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);
    client.on('setupcomplete', onSetupComplete);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('setupcomplete', onSetupComplete);
    };
  }, [client, addPerfLog]);

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('Live API configuration has not been set.');
    }
    setIsConnecting(true);
    addPerfLog({ turn: 0, event: 'Live API: Connecting...' });
    
    await client.connect(config);
    setIsConnecting(false);
  }, [client, config, addPerfLog]);

  const disconnect = useCallback(() => {
    client.disconnect();
    setConnected(false);
    setIsConnecting(false);
    audioStreamerRef.current?.stop();
  }, [client]);

  const stopAudio = useCallback(() => {
    audioStreamerRef.current?.stop();
  }, []);

  const resetConnection = useCallback(() => {
    disconnect();
    // We don't auto-connect here, just reset the state so the user can try again.
  }, [disconnect]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    isConnecting,
    disconnect,
    volume,
    stopAudio,
    resetConnection,
  };
}
