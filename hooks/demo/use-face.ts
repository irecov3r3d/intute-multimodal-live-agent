/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';

export type FaceResults = {
  /** A value that represents how open the eyes are. */
  eyesScale: number;
  /** A value that represents how open the mouth is. */
  mouthScale: number;
};

/* Easing function examples - uncomment to experiment with different animation curves.
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
// ... other easing functions ...
*/

/**
 * An easing function that produces a quintic ease-out curve.
 * This creates a natural-looking deceleration effect for animations.
 */
function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

/**
 * Constrains a value to be within a specified range.
 */
function clamp(x: number, lowerlimit: number, upperlimit: number) {
  if (x < lowerlimit) x = lowerlimit;
  if (x > upperlimit) x = upperlimit;
  return x;
}

/**
 * A smoothstep function that interpolates smoothly between 0 and 1.
 * It's used here to create a more natural transition for eye blinking.
 */
function smoothstep(edge0: number, edge1: number, x: number) {
  // Scale, bias, and saturate to the range [0, 1].
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  // Apply cubic polynomial smoothing.
  return x * x * (3 - 2 * x);
}

type BlinkProps = {
  speed: number;
  isActive: boolean;
};

/**
 * A custom hook that generates a continuous, natural-looking blinking animation.
 * It uses a sine wave and easing functions to control the vertical scale of the eyes.
 */
export function useBlink({ speed, isActive }: BlinkProps) {
  const [eyeScale, setEyeScale] = useState(1);
  const [frame, setFrame] = useState(0);

  const frameId = useRef(-1);

  useEffect(() => {
    if (!isActive) {
      if (frameId.current) {
        window.cancelAnimationFrame(frameId.current);
      }
      return;
    }

    // Animation loop using requestAnimationFrame.
    function nextFrame() {
      frameId.current = window.requestAnimationFrame(() => {
        setFrame(frame + 1);
        // Use a sine wave to create a smooth up-and-down motion.
        let s = easeOutQuint((Math.sin(frame * speed) + 1) * 2);
        // Apply smoothstep to refine the blinking curve.
        s = smoothstep(0.1, 0.25, s);
        s = Math.min(1, s);
        setEyeScale(s);
        nextFrame();
      });
    }

    nextFrame();

    return () => {
      window.cancelAnimationFrame(frameId.current);
    };
  }, [speed, eyeScale, frame, isActive]);

  return eyeScale;
}

/**
 * A custom hook that combines different animation effects for the face.
 * @param isActive Controls whether the face animations are running.
 * @returns An object with `eyeScale` and `mouthScale` values for rendering.
 */
export default function useFace({ isActive = true }) {
  // The volume of the agent's speech directly controls the mouth opening.
  const { volume } = useLiveAPIContext();
  // The useBlink hook provides the eye scaling for the blinking animation.
  const eyeScale = useBlink({ speed: 0.0125, isActive });

  // The mouth scale is a simple mapping of audio volume.
  return { eyeScale, mouthScale: volume / 2 };
}