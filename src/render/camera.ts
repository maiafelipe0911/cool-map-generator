/**
 * camera.ts
 * ---------
 * Camera state for panning across the isometric world.
 *
 * The camera stores a pixel offset (x, y) that shifts the isometric origin.
 * Dragging the mouse moves the camera, which moves the entire grid on screen.
 */

import { fromScreen } from "./isometric";
import type { IsoConfig } from "./isometric";

export interface Camera {
  x: number;
  y: number;
}

/** Create a camera centered at the origin. */
export function createCamera(): Camera {
  return { x: 0, y: 0 };
}

/**
 * Build an IsoConfig whose origin is offset by the camera position.
 *
 * The origin sits at the horizontal center of the canvas, shifted vertically
 * so the grid fans downward from the top quarter. The camera offset pans
 * the entire projection.
 */
export function cameraConfig(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  tileWidth: number,
  tileHeight: number,
): IsoConfig {
  return {
    originX: canvasWidth / 2 + camera.x,
    originY: canvasHeight / 4 + camera.y,
    tileWidth,
    tileHeight,
  };
}

/**
 * Compute the bounding box (in world cell coordinates) of everything currently
 * visible on the canvas.
 *
 * Applies `fromScreen` to all four canvas corners, takes the min/max of the
 * resulting col/row values, and adds ±1 cell padding so chunk boundaries
 * never pop in late.
 */
export function visibleWorldBounds(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  tileWidth: number,
  tileHeight: number,
): { minCol: number; minRow: number; maxCol: number; maxRow: number } {
  const config = cameraConfig(camera, canvasWidth, canvasHeight, tileWidth, tileHeight);

  const corners = [
    fromScreen(0, 0, config),
    fromScreen(canvasWidth, 0, config),
    fromScreen(0, canvasHeight, config),
    fromScreen(canvasWidth, canvasHeight, config),
  ];

  const cols = corners.map((c) => c.col);
  const rows = corners.map((c) => c.row);

  return {
    minCol: Math.floor(Math.min(...cols)) - 1,
    minRow: Math.floor(Math.min(...rows)) - 1,
    maxCol: Math.ceil(Math.max(...cols)) + 1,
    maxRow: Math.ceil(Math.max(...rows)) + 1,
  };
}
