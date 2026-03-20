/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { RefObject, useEffect, useState, useRef } from 'react';

import { renderBasicFace } from './basic-face-render';

import useFace from '../../../hooks/demo/use-face';
import useHover from '../../../hooks/demo/use-hover';
import useTilt from '../../../hooks/demo/use-tilt';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

type BasicFaceProps = {
  /** The canvas element on which to render the face. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The radius of the face. */
  radius?: number;
  /** The color of the face. */
  color?: string;
  /** Whether the agent is currently talking. */
  isTalking: boolean;
};

/**
 * A component that renders an animated, expressive face on a canvas.
 * It uses custom hooks to manage its state and animations, driven by
 * data from the LiveAPIContext.
 */
export default function BasicFace({
  canvasRef,
  radius = 250,
  color,
  isTalking,
}: BasicFaceProps) {
  // Audio output volume from the Live API, used to control mouth movement.
  const { volume, connected } = useLiveAPIContext();

  // Custom hooks to manage different aspects of the face's animation.
  const { eyeScale, mouthScale } = useFace({ isActive: connected });
  const hoverPosition = useHover({ isActive: connected });
  const tiltAngle = useTilt({
    maxAngle: 5,
    speed: 0.075,
    isActive: connected && isTalking,
  });

  // This effect is responsible for re-rendering the face on the canvas
  // whenever any of its properties (like eye/mouth scale or color) change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderBasicFace({ ctx, mouthScale, eyeScale, color });
  }, [canvasRef, volume, eyeScale, mouthScale, color]);

  return (
    <canvas
      className="basic-face"
      ref={canvasRef}
      width={radius * 2}
      height={radius * 2}
      style={{
        display: 'block',
        borderRadius: '50%',
        // The transform applies the hover and tilt effects calculated by the custom hooks.
        transform: `translateY(${hoverPosition}px) rotate(${tiltAngle}deg)`,
      }}
    />
  );
}