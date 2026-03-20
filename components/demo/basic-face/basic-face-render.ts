/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
type BasicFaceProps = {
  ctx: CanvasRenderingContext2D;
  mouthScale: number;
  eyeScale: number;
  color?: string;
};

/**
 * A helper function to draw a single eye on the canvas.
 * It uses save/restore and translate/scale to position and shape the eye
 * without affecting other parts of the drawing.
 * @param ctx The canvas rendering context.
 * @param pos An array [x, y] for the eye's center position.
 * @param radius The radius of the eye.
 * @param scaleY The vertical scale factor, used for blinking animations.
 */
const eye = (
  ctx: CanvasRenderingContext2D,
  pos: [number, number],
  radius: number,
  scaleY: number
) => {
  ctx.save();
  ctx.translate(pos[0], pos[1]);
  ctx.scale(1, scaleY);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.restore();
  ctx.fill();
};

/**
 * Renders the entire face onto the provided canvas context.
 * This function is called on every frame to update the animation.
 * @param props An object containing the canvas context and scaling factors for eyes and mouth.
 */
export function renderBasicFace(props: BasicFaceProps) {
  const {
    ctx,
    eyeScale: eyesOpenness,
    mouthScale: mouthOpenness,
    color,
  } = props;
  const { width, height } = ctx.canvas;

  // Clear the canvas to prepare for the new frame.
  ctx.clearRect(0, 0, width, height);

  // Draw the main background circle of the face.
  ctx.fillStyle = color || 'white';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, width / 2 - 20, 0, Math.PI * 2);
  ctx.fill();

  // Define the positions and dimensions for the eyes based on the canvas size.
  const eyesCenter = [width / 2, height / 2.425];
  const eyesOffset = width / 15;
  const eyeRadius = width / 30;
  const eyesPosition: Array<[number, number]> = [
    [eyesCenter[0] - eyesOffset, eyesCenter[1]], // Left eye
    [eyesCenter[0] + eyesOffset, eyesCenter[1]], // Right eye
  ];

  // Draw both eyes using the helper function.
  ctx.fillStyle = 'black';
  eye(ctx, eyesPosition[0], eyeRadius, eyesOpenness + 0.1);
  eye(ctx, eyesPosition[1], eyeRadius, eyesOpenness + 0.1);

  // Define the position and shape for the mouth.
  // The vertical extent is directly controlled by the `mouthOpenness` parameter.
  const mouthCenter = [width / 2, (height / 2.875) * 1.55];
  const mouthExtent = [width / 10, (height / 5) * mouthOpenness + 10];

  // Draw the mouth using two ellipses to create a filled shape.
  ctx.save();
  ctx.translate(mouthCenter[0], mouthCenter[1]);
  ctx.scale(1, mouthOpenness + height * 0.002);
  ctx.fillStyle = 'black';
  ctx.beginPath();
  // The main outer ellipse for the mouth shape.
  ctx.ellipse(0, 0, mouthExtent[0], mouthExtent[1], 0, 0, Math.PI, false);
  // An inner, smaller ellipse to "hollow out" the top part, creating the lip line.
  ctx.ellipse(0, 0, mouthExtent[0], mouthExtent[1] * 0.45, 0, 0, Math.PI, true);
  ctx.fill();
  ctx.restore();
}