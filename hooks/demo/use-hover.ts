/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';

interface HoverProps {
  /** Maximum distance in pixels that the element will move up and down from its initial position. */
  amplitude?: number;
  /** Number of complete hover cycles per second. Lower values create slower, gentler movement. */
  frequency?: number;
  /** Whether the hover animation is currently active. */
  isActive?: boolean;
}

/**
 * A custom hook that creates a gentle, continuous up-and-down hovering animation.
 * It returns a vertical offset value that can be applied to a component's `transform` style.
 */
export default function useHover({
  amplitude = 10,
  frequency = 0.5,
  isActive = true,
}: HoverProps = {}) {
  const [offset, setOffset] = useState(0);
  const startTimeRef = useRef(Date.now());
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    // If the animation is not active, cancel any pending animation frame.
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // The main animation loop.
    const animate = () => {
      // Calculate time elapsed in seconds since the animation started.
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      // Use a sine wave to create a smooth, periodic motion.
      // - `elapsed * frequency * Math.PI` calculates the angle for the sine function.
      // - `Math.sin(...)` returns a value between -1 and 1.
      // - Multiplying by `amplitude` scales the motion to the desired pixel range.
      const newOffset = Math.sin(elapsed * frequency * Math.PI) * amplitude;

      setOffset(newOffset);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop.
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup function: cancel the animation frame when the component unmounts
    // or when the animation parameters change.
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [amplitude, frequency, isActive]);

  return offset;
}