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

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

/**
 * Encodes an ArrayBuffer into a base64 string.
 * @param buffer The ArrayBuffer to encode.
 * @returns The base64-encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Defines the events that the AudioRecorder can emit.
type AudioRecorderEvents = {
  data: (base64: string) => void;
  volume: (volume: number) => void;
};

/**
 * A class for recording audio from the user's microphone. It uses the Web Audio API
 * and an AudioWorklet to process the audio in a separate thread, converting it to
 * PCM16 format and emitting it as base64-encoded chunks.
 */
export class AudioRecorder {
  private emitter = new EventEmitter<AudioRecorderEvents>();
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  // A promise that resolves when the start() process is complete.
  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 24000) {}

  /**
   * Starts the audio recording process. It requests microphone access, sets up
   * the AudioContext and processing nodes (AudioWorklet), and begins streaming data.
   */
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    // Use a promise to handle the asynchronous setup process.
    this.starting = new Promise(async (resolve, reject) => {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = await audioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Set up the main audio recording worklet.
      const workletName = 'audio-recorder-worklet';
      const src = createWorketFromSrc(workletName, AudioRecordingWorklet);
      await this.audioContext.audioWorklet.addModule(src);
      this.recordingWorklet = new AudioWorkletNode(this.audioContext, workletName);

      // Handle messages from the worklet, which contain the processed audio data.
      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        if (!this.recording) return;
        const arrayBuffer = ev.data.data.int16arrayBuffer;
        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          this.emitter.emit('data', arrayBufferString);
        }
      };
      this.source.connect(this.recordingWorklet);

      // Set up a separate worklet for the volume meter.
      const vuWorkletName = 'vu-meter';
      await this.audioContext.audioWorklet.addModule(createWorketFromSrc(vuWorkletName, VolMeterWorket));
      this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
      this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        this.emitter.emit('volume', ev.data.volume);
      };
      this.source.connect(this.vuWorklet);

      this.recording = true;
      resolve();
      this.starting = null; // Clear the promise once setup is complete.
    });
  }

  /**
   * Stops the audio recording and cleans up all resources.
   */
  stop() {
    // It's possible for `stop()` to be called before `start()` has fully completed.
    // This logic handles that race condition gracefully.
    const handleStop = () => {
      this.recording = false;
      if (this.recordingWorklet) {
        this.recordingWorklet.port.onmessage = null;
        try { this.recordingWorklet.disconnect(); } catch(e) {}
      }
      if (this.vuWorklet) {
        this.vuWorklet.port.onmessage = null;
        try { this.vuWorklet.disconnect(); } catch(e) {}
      }
      try { this.source?.disconnect(); } catch(e) {}
      this.stream?.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      
      // If we own the audio context, we should suspend it to save resources
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try { this.audioContext.suspend(); } catch(e) {}
      }

      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      this.source = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop).catch(handleStop);
      return;
    }
    handleStop();
  }
}