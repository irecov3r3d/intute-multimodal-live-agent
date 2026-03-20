/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';

export type UseTiltProps = {
  /** Maximum tilt angle (degrees) in either direction. */
  maxAngle: number;
  /** How quickly the tilt occurs. Lower values create slower, gentler movement. */
  speed?: number;
  /** Whether tilt mode is currently active. */
  isActive: boolean;
};

/**
 * Maps a value from one numerical range to another.
 * e.g., scalemap(0.5, 0, 1, 0, 100) would return 50.
 */
export function scalemap(
  value: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number
): number {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

/**
 * A custom hook that creates a subtle, randomized tilting animation.
 * The element will gently tilt back and forth to random angles within the specified `maxAngle`.
 */
export default function useTilt({
  maxAngle = 5,
  speed = 0.1,
  isActive = false,
}: UseTiltProps) {
  const [angle, setAngle] = useState<number>(0);
  const [targetAngle, setTargetAngle] = useState<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const animationFrameRef = useRef<number>(0);

  // When the tilt animation is deactivated, smoothly return to a neutral (0 degree) angle.
  useEffect(() => {
    if (!isActive) {
      setTargetAngle(0);
    }
  }, [isActive]);

  // This effect schedules the next random tilt. It runs continuously while `isActive` is true.
  useEffect(() => {
    if (!isActive) return;

    const scheduleNextTilt = () => {
      // Set a random delay for the next change in angle.
      const delay = 1000 + Math.random() * 2000; // Random delay between 1-3 seconds
      timeoutRef.current = setTimeout(() => {
        // First, check if we should return to the center before picking a new angle.
        if (Math.abs(targetAngle) > 0.1) {
          setTargetAngle(0);
        } else {
          // Pick a new random target angle.
          const newAngle =
            (Math.random() > 0.5 ? 1 : -1) * // Randomly choose left or right
            (maxAngle * 0.3 + Math.random() * maxAngle * 0.7); // Choose a random angle magnitude
          setTargetAngle(newAngle);
        }
        // Schedule the next tilt recursively.
        scheduleNextTilt();
      }, delay);
    };

    scheduleNextTilt();

    // Cleanup: clear the timeout when the component unmounts or dependencies change.
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [maxAngle, isActive, targetAngle]); // Rerun if targetAngle changes to reset timer logic

  // This effect handles the smooth animation from the current angle to the target angle.
  useEffect(() => {
    const animate = () => {
      setAngle(currentAngle => {
        const diff = targetAngle - currentAngle;
        // Ease towards the target angle. This creates a smooth, non-linear movement.
        const delta = diff * speed;
        return currentAngle + delta;
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetAngle, speed]);

  return angle;
}