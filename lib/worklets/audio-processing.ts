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

/**
 * ===================================================================
 *  Audio Recording AudioWorklet with Voice Activity Detection (VAD)
 * ===================================================================
 * This script runs in a separate, high-priority audio thread and is
 * responsible for processing and trimming silence from raw audio data
 * from the microphone.
 *
 * How it works:
 * 1. The `process` method receives chunks of raw audio as Float32Arrays.
 * 2. It analyzes each chunk to determine if it contains speech or silence
 *    based on a volume threshold.
 * 3. **Leading Silence & Pre-buffering:** Before speech is detected, it
 *    maintains a rolling buffer of recent silent audio. This prevents the
 *    clipping of initial utterances (e.g., short words like "Yes").
 * 4. **Speech Detection:** When a chunk exceeds the silence threshold, the
 *    worklet dumps the pre-speech buffer into the main recording buffer,
 *    followed by the current speech chunk.
 * 5. **Trailing Silence:** If it detects a continuous silence longer than
 *    a set timeout after speech has started, it stops processing and waits
 *    for the next speech segment, trimming the long silence at the end.
 * 6. The processed audio is converted to 16-bit PCM and sent to the
 *    main thread for streaming.
 * ===================================================================
 */
const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {

  // Buffer to hold audio samples before sending them to the main thread.
  // It sends and clears the buffer every 2048 samples, which at 24kHz
  // is about 11 times a second.
  buffer = new Int16Array(2048);

  // Current write index for the buffer.
  bufferWriteIndex = 0;

  // --- Voice Activity Detection (VAD) State ---
  // A float32 sample is in the range [-1.0, 1.0]. This threshold determines
  // the minimum amplitude to be considered "speech".
  SILENCE_THRESHOLD = 0.01;
  
  // The number of consecutive silent frames to wait before considering the
  // user to have stopped speaking. At 24kHz with 128-sample frames, the
  // browser provides ~187.5 frames per second. 1.5 seconds of silence is
  // roughly 280 frames.
  SILENCE_TIMEOUT_FRAMES = 280;

  // Buffer to hold ~200ms of audio before speech is detected.
  // This helps prevent clipping the beginning of words.
  PRE_SPEECH_BUFFER_SIZE = 40; // 40 frames * 128 samples/frame / 24000 samples/sec = ~213ms
  preSpeechBuffer = [];

  hasSpeechStarted = false;
  silenceFrameCounter = 0;
  // --- End VAD State ---

  constructor() {
    super();
  }

  /**
   * The main processing function, called by the browser's audio engine.
   * @param inputs An array of inputs, where each input has an array of channels,
   *               and each channel is a Float32Array of audio samples.
   */
  process(inputs) {
    if (inputs[0] && inputs[0][0]) {
      const channelData = inputs[0][0];

      // --- VAD Logic ---
      let maxAmplitude = 0;
      for (let i = 0; i < channelData.length; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
      }
      const isSpeechChunk = maxAmplitude > this.SILENCE_THRESHOLD;

      if (!this.hasSpeechStarted) {
        if (isSpeechChunk) {
          // --- Speech Detected ---
          this.hasSpeechStarted = true;
          this.silenceFrameCounter = 0;
          
          // Dump the pre-speech buffer to capture the start of the utterance
          this.preSpeechBuffer.forEach(buf => this.bufferAndSendChunk(buf));
          this.preSpeechBuffer = [];

          // Now, process the current chunk that triggered the detection
          this.bufferAndSendChunk(channelData);

        } else {
          // --- Silence before speech ---
          // Keep a rolling buffer of recent silence
          this.preSpeechBuffer.push(channelData.slice());
          if (this.preSpeechBuffer.length > this.PRE_SPEECH_BUFFER_SIZE) {
            this.preSpeechBuffer.shift();
          }
        }
      } else {
        // --- Speech is in progress ---
        if (!isSpeechChunk) {
          this.silenceFrameCounter++;
        } else {
          this.silenceFrameCounter = 0;
        }

        if (this.silenceFrameCounter > this.SILENCE_TIMEOUT_FRAMES) {
          // --- Long silence, end of utterance ---
          if (this.bufferWriteIndex > 0) {
            this.sendAndClearBuffer();
          }
          this.hasSpeechStarted = false;
          this.preSpeechBuffer = []; // Clear buffer for next time
        } else {
          // --- Speech or short pause, buffer it ---
          this.bufferAndSendChunk(channelData);
        }
      }
    }

    return true; // Return true to keep the processor alive.
  }

  /**
   * Sends the current buffer to the main thread and resets the write index.
   */
  sendAndClearBuffer(){
    this.port.postMessage({
      event: "chunk",
      data: {
        int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
      },
    });
    this.bufferWriteIndex = 0;
  }

  /**
   * Processes a chunk of Float32 audio data, converts it to Int16,
   * adds it to the buffer, and sends the buffer if it's full.
   */
  bufferAndSendChunk(float32Array) {
    const l = float32Array.length;
    
    for (let i = 0; i < l; i++) {
      // Convert float32 from range [-1, 1] to int16 from range [-32768, 32767].
      const int16Value = float32Array[i] * 32768;
      this.buffer[this.bufferWriteIndex++] = int16Value;

      // If the buffer is full, send it.
      if(this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }
  }
}
`;

export default AudioRecordingWorklet;