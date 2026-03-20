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

import {
  createWorketFromSrc,
  registeredWorklets,
} from './audioworklet-registry';

/**
 * A class for streaming and playing raw PCM audio data with low latency.
 * It manages an audio queue and uses the Web Audio API's precise timing
 * to schedule playback of audio chunks, ensuring a smooth, gapless stream.
 */
export class AudioStreamer {
  private sampleRate: number = 24000;
  private bufferSize: number = 7680; // A buffer size for chunking audio data.
  // A queue of audio buffers (as Float32Arrays) waiting to be played.
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  // Flag to indicate if the stream has been intentionally stopped (e.g., by an interruption).
  private isStreamComplete: boolean = false;
  // A polling interval used to check for new audio data when the queue is empty.
  private checkInterval: number | null = null;
  // The precise AudioContext time at which the next buffer should start playing. This is the core of gapless playback.
  private scheduledTime: number = 0;
  // A small initial delay to allow some audio to buffer before starting playback.
  private initialBufferTime: number = 0.1; // 100ms
  // Core Web Audio API nodes.
  public gainNode: GainNode;
  public source: AudioBufferSourceNode;
  // A reference to the last scheduled audio source to detect when the queue has finished playing.
  private endOfQueueAudioSource: AudioBufferSourceNode | null = null;

  public onComplete = () => {};

  constructor(public context: AudioContext) {
    this.gainNode = this.context.createGain();
    this.source = this.context.createBufferSource();
    this.gainNode.connect(this.context.destination);
    this.addPCM16 = this.addPCM16.bind(this);
  }

  /**
   * Dynamically adds an AudioWorklet to the audio processing graph.
   */
  async addWorklet<T extends (d: any) => void>(
    workletName: string,
    workletSrc: string,
    handler: T
  ): Promise<this> {
    let workletsRecord = registeredWorklets.get(this.context);
    if (workletsRecord && workletsRecord[workletName]) {
      // If the worklet already exists, just add the new handler to it.
      workletsRecord[workletName].handlers.push(handler);
      return Promise.resolve(this);
    }

    if (!workletsRecord) {
      registeredWorklets.set(this.context, {});
      workletsRecord = registeredWorklets.get(this.context)!;
    }

    // Create a new record for this worklet.
    workletsRecord[workletName] = { handlers: [handler] };

    const src = createWorketFromSrc(workletName, workletSrc);
    await this.context.audioWorklet.addModule(src);
    const worklet = new AudioWorkletNode(this.context, workletName);

    workletsRecord[workletName].node = worklet;
    return this;
  }

  /**
   * Converts a Uint8Array of 16-bit PCM audio data into a Float32Array.
   * PCM16 is a common raw audio format, but the Web Audio API requires
   * audio data as Float32Arrays with samples normalized between -1.0 and 1.0.
   */
  private _processPCM16Chunk(chunk: Uint8Array): Float32Array {
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error(e);
      }
    }
    return float32Array;
  }

  /**
   * Adds a chunk of raw PCM16 audio data to the playback queue.
   * @param chunk The Uint8Array containing the audio data.
   */
  addPCM16(chunk: Uint8Array) {
    this.isStreamComplete = false;
    let processingBuffer = this._processPCM16Chunk(chunk);

    // Break the incoming audio into smaller, manageable buffers.
    while (processingBuffer.length >= this.bufferSize) {
      const buffer = processingBuffer.slice(0, this.bufferSize);
      this.audioQueue.push(buffer);
      processingBuffer = processingBuffer.slice(this.bufferSize);
    }
    if (processingBuffer.length > 0) {
      this.audioQueue.push(processingBuffer);
    }

    // If playback isn't already active, start it.
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.scheduledTime = this.context.currentTime + this.initialBufferTime;
      this.scheduleNextBuffer();
    }
  }

  private createAudioBuffer(audioData: Float32Array): AudioBuffer {
    const audioBuffer = this.context.createBuffer(1, audioData.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(audioData);
    return audioBuffer;
  }

  /**
   * The core scheduling logic. It pulls buffers from the queue and schedules
   * them for future playback, ensuring they line up perfectly to avoid gaps or clicks.
   */
  private scheduleNextBuffer() {
    // If playback has lagged (e.g., due to network delay or main thread work),
    // the scheduled time for the next buffer may be in the past. To prevent
    // audio glitches, we reset the schedule time to play as soon as possible,
    // adding a tiny safety buffer to ensure the context is ready.
    if (this.scheduledTime < this.context.currentTime) {
      const safetyBuffer = 0.01; // 10ms
      this.scheduledTime = this.context.currentTime + safetyBuffer;
    }

    // Schedule audio chunks ahead of time to be resilient to brief stalls.
    const SCHEDULE_AHEAD_TIME = 0.2; // 200ms

    while (
      this.audioQueue.length > 0 &&
      this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME
    ) {
      const audioData = this.audioQueue.shift()!;
      const audioBuffer = this.createAudioBuffer(audioData);
      const source = this.context.createBufferSource();

      // Track the very last source node to detect when playback is fully complete.
      if (this.audioQueue.length === 0) {
        if (this.endOfQueueAudioSource) {
          this.endOfQueueAudioSource.onended = null;
        }
        this.endOfQueueAudioSource = source;
        source.onended = () => {
          if (!this.audioQueue.length && this.endOfQueueAudioSource === source) {
            this.endOfQueueAudioSource = null;
            this.onComplete();
          }
        };
      }

      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Connect the source to any registered AudioWorklets (e.g., for volume metering).
      const worklets = registeredWorklets.get(this.context);
      if (worklets) {
        Object.values(worklets).forEach(({ node, handlers }) => {
          if (node) {
            source.connect(node);
            node.port.onmessage = (ev: MessageEvent) => {
              handlers.forEach(handler => handler.call(node.port, ev));
            };
            node.connect(this.context.destination);
          }
        });
      }

      source.start(this.scheduledTime);
      // Crucially, increment the scheduled time by the exact duration of the buffer we just scheduled.
      this.scheduledTime += audioBuffer.duration;
    }

    if (this.audioQueue.length === 0) {
      // The queue is empty.
      if (this.isStreamComplete) {
        // ...and the stream has been marked as complete, so we stop.
        this.isPlaying = false;
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      } else {
        // ...but the stream is not complete, so we poll for more data.
        if (!this.checkInterval) {
          this.checkInterval = window.setInterval(() => {
            if (this.audioQueue.length > 0) {
              if (this.checkInterval) clearInterval(this.checkInterval);
              this.checkInterval = null;
              this.scheduleNextBuffer();
            }
          }, 100) as unknown as number;
        }
      }
    } else {
      // The queue still has data, so schedule the next check.
      const nextCheckTime = (this.scheduledTime - this.context.currentTime) * 1000;
      setTimeout(() => this.scheduleNextBuffer(), Math.max(0, nextCheckTime - 50));
    }
  }

  /**
   * Immediately stops all scheduled and playing audio and clears the queue.
   * This is used for interruptions.
   */
  stop() {
    this.isPlaying = false;
    this.isStreamComplete = true;
    this.audioQueue = [];
    this.scheduledTime = this.context.currentTime;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Fade out the volume smoothly before disconnecting nodes to avoid clicks.
    this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);

    setTimeout(() => {
      this.gainNode.disconnect();
      this.gainNode = this.context.createGain(); // Recreate the gain node for the next playback session.
      this.gainNode.connect(this.context.destination);
    }, 200);
  }

  /**
   * Resumes the AudioContext if it was suspended (e.g., by browser policy)
   * and prepares the streamer for a new playback session.
   */
  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.isStreamComplete = false;
    this.scheduledTime = this.context.currentTime + this.initialBufferTime;
    this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
  }

  /**
   * Marks the stream as complete. Once the current queue is empty, playback will stop.
   */
  complete() {
    this.isStreamComplete = true;
    this.onComplete();
  }
}