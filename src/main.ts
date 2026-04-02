/**
 * main.ts
 * -------
 * Entry point — the only file that bridges input, logic, and render.
 *
 * Runs a requestAnimationFrame game loop:
 *   1. Read mouse drag deltas and update camera.
 *   2. Build an IsoConfig offset by the camera.
 *   3. Re-render the grid every frame.
 */

import { createMockRegistry } from "./data/mock-tiles";
import { generate } from "./logic/wfc-engine";
import { initCanvas } from "./render/canvas";
import { createCamera, cameraConfig } from "./render/camera";
import { renderGrid } from "./render/grid-renderer";
import { createDragState, attachDragListeners, consumeDelta } from "./input/mouse";

const GRID_SIZE = 16;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;

// --- Data + Logic -----------------------------------------------------------

const registry = createMockRegistry();
const result = generate(GRID_SIZE, GRID_SIZE, registry);

if (!result.ok) {
  throw new Error(`WFC generation failed: ${result.reason}`);
}

const { grid, width, height } = result;

// --- Render + Input setup ---------------------------------------------------

const { canvas, ctx, cleanup: cleanupCanvas } = initCanvas();
const camera = createCamera();
const dragState = createDragState();
const cleanupDrag = attachDragListeners(canvas, dragState);

// --- Game loop --------------------------------------------------------------

function frame() {
  // 1. Apply drag movement to camera.
  const { dx, dy } = consumeDelta(dragState);
  camera.x += dx;
  camera.y += dy;

  // 2. Build camera-aware isometric config.
  const config = cameraConfig(camera, canvas.width, canvas.height, TILE_WIDTH, TILE_HEIGHT);

  // 3. Render.
  renderGrid(ctx, grid, width, height, config);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// --- Vite HMR cleanup -------------------------------------------------------

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupCanvas();
    cleanupDrag();
  });
}
