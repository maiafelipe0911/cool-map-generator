/**
 * main.ts
 * -------
 * Entry point — the only file that bridges input, logic, and render.
 *
 * Runs a requestAnimationFrame game loop:
 *   1. Read mouse drag deltas and update the camera.
 *   2. Compute which world cells are visible.
 *   3. Ask the chunk manager for those chunks (generates new ones on demand).
 *   4. Render all visible chunks using a world-row sweep for correct depth.
 */

import { createTileRegistry } from "./data/tiles";
import { createBiomeWeightFn } from "./data/biomes";
import { createChunkManager } from "./logic/chunk-manager";
import { initCanvas } from "./render/canvas";
import { createCamera, cameraConfig, visibleWorldBounds } from "./render/camera";
import { renderChunks } from "./render/grid-renderer";
import { createDragState, attachDragListeners, consumeDelta } from "./input/mouse";

const CHUNK_SIZE = 16;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;

// --- Data + Logic -----------------------------------------------------------

const WORLD_SEED = 42;

const registry = createTileRegistry();
const biomeWeightFn = createBiomeWeightFn(WORLD_SEED);
const chunkManager = createChunkManager(registry, CHUNK_SIZE, biomeWeightFn);

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

  // 3. Determine which world cells are on screen, then fetch (or generate) the
  //    chunks that cover them.
  const bounds = visibleWorldBounds(
    camera,
    canvas.width,
    canvas.height,
    TILE_WIDTH,
    TILE_HEIGHT,
  );
  const visibleChunks = chunkManager.getVisibleChunks(
    bounds.minCol,
    bounds.minRow,
    bounds.maxCol,
    bounds.maxRow,
  );

  // 4. Render.
  renderChunks(ctx, visibleChunks, CHUNK_SIZE, config);

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
