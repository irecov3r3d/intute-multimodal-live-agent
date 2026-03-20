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

type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

// A map to store and reuse AudioContext instances, acting as a singleton manager.
const map: Map<string, AudioContext> = new Map();

/**
 * A singleton-like getter for the AudioContext.
 * Browsers often require a user interaction (like a click) before an
 * AudioContext can be created or resumed. This utility handles that
 * complexity by waiting for an interaction if necessary. It also caches
 * and reuses contexts based on an ID to avoid creating multiple instances.
 */
export const audioContext: (
  options?: GetAudioContextOptions
) => Promise<AudioContext> = (() => {
  // A promise that resolves once the user has interacted with the page.
  const didInteract = new Promise(res => {
    window.addEventListener('pointerdown', res, { once: true });
    window.addEventListener('keydown', res, { once: true });
  });

  return async (options?: GetAudioContextOptions) => {
    try {
      // Attempt to play a silent audio clip to "unlock" the AudioContext.
      const a = new Audio();
      a.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      await a.play();

      // Check if a context with this ID already exists.
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id);
        if (ctx) return ctx;
      }
      // Create and cache a new context.
      const ctx = new AudioContext(options);
      if (options?.id) map.set(options.id, ctx);
      return ctx;
    } catch (e) {
      // If the initial attempt fails (e.g., due to autoplay restrictions),
      // wait for user interaction and then try again.
      await didInteract;
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id);
        if (ctx) return ctx;
      }
      const ctx = new AudioContext(options);
      if (options?.id) map.set(options.id, ctx);
      return ctx;
    }
  };
})();

/**
 * Decodes a base64 string into an ArrayBuffer.
 * This is a necessary utility for handling audio data, which is often
 * transmitted as base64.
 * @param base64 The base64-encoded string.
 * @returns The decoded ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper function to write a string to a DataView for WAV header creation.
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Creates a Blob representing a WAV audio file from raw PCM audio data.
 * @param pcmData The raw PCM audio data as an ArrayBuffer.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @returns A Blob object for the complete WAV file.
 */
export function encodeWAV(pcmData: ArrayBuffer, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.byteLength;

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // (file size) - 8
  writeString(view, 8, 'WAVE');
  // "fmt" sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // Audio format 1 for PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); // (Sample Rate * BitsPerSample * Channels) / 8
  view.setUint16(32, blockAlign, true); // (NumChannels * BitsPerSample) / 8
  view.setUint16(34, bitsPerSample, true);
  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

/**
 * Calculates the duration of a raw PCM audio blob in seconds.
 * @param blob The raw audio blob.
 * @returns A string representing the duration (e.g., "3.2s").
 */
export const getAudioDuration = (blob: Blob) => {
  const bytesPerSample = 2; // 16-bit audio
  const sampleRate = 24000;
  const durationInSeconds = blob.size / (sampleRate * bytesPerSample);
  return `${durationInSeconds.toFixed(1)}s`;
};
