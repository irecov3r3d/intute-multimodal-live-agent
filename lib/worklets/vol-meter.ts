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
 *  Volume Meter AudioWorklet
 * ===================================================================
 * This script runs in a separate audio thread and is responsible for
 * calculating the volume of an audio stream.
 *
 * How it works:
 * 1. The `process` method receives chunks of audio samples.
 * 2. It calculates the Root Mean Square (RMS) of the samples, which is a
 *    good measure of perceived loudness.
 * 3. It periodically sends the calculated volume level back to the
 *    main thread via `this.port.postMessage`.
 *
 * This allows for efficient, non-blocking volume analysis that can be
 * used to drive UI elements (like a talking animation) without impacting
 * the main thread's performance.
 * ===================================================================
 */
const VolMeterWorket = `
  class VolMeter extends AudioWorkletProcessor {
    volume
    updateIntervalInMS
    nextUpdateFrame

    constructor() {
      super()
      this.volume = 0
      this.updateIntervalInMS = 25 // How often to send an update to the main thread.
      this.nextUpdateFrame = this.updateIntervalInMS
      this.port.onmessage = event => {
        if (event.data.updateIntervalInMS) {
          this.updateIntervalInMS = event.data.updateIntervalInMS
        }
      }
    }

    get intervalInFrames() {
      return (this.updateIntervalInMS / 1000) * sampleRate
    }

    process(inputs) {
      const input = inputs[0]

      if (input.length > 0) {
        const samples = input[0]
        let sum = 0
        let rms = 0

        // Calculate the sum of the squares of the samples.
        for (let i = 0; i < samples.length; ++i) {
          sum += samples[i] * samples[i]
        }

        // Calculate the RMS.
        rms = Math.sqrt(sum / samples.length)
        // Use a simple smoothing algorithm to make the volume changes less jarring.
        this.volume = Math.max(rms, this.volume * 0.7)

        // Send an update to the main thread periodically.
        this.nextUpdateFrame -= samples.length
        if (this.nextUpdateFrame < 0) {
          this.nextUpdateFrame += this.intervalInFrames
          this.port.postMessage({volume: this.volume})
        }
      }

      return true
    }
  }`;

export default VolMeterWorket;