/**
 * grid-renderer.ts
 * ----------------
 * Draws a collapsed WFC grid as colored isometric diamonds on an HTML5 Canvas.
 *
 * Each cell is rendered as a rhombus (diamond shape) at its isometric
 * screen position. The fill color depends on the tile type:
 *   Water → blue, Sand → yellow, Grass → green.
 */

import type { Chunk, Grid } from "../logic/types";
import type { IsoConfig } from "./isometric";
import { toScreen } from "./isometric";

/** Maps tile IDs to fill colors. */
const TILE_COLORS: Record<string, string> = {
  // Water terrain
  deep_water: "#2a5aa7",
  water:      "#4a90d9",
  // Coastal / transitional
  sand:       "#e8d44d",
  marsh:      "#6b8e5a",
  dirt:       "#a0724a",
  // Land terrain
  grass:      "#5cb85c",
  forest:     "#2d6b2d",
  // Elevated terrain
  hill:       "#8b7355",
  mountain:   "#6b6b6b",
  snow:       "#e8e8f0",
};

const DEFAULT_COLOR = "#888888";

/**
 * Render the entire collapsed grid onto the canvas.
 *
 * Iterates row-by-row, col-by-col — this gives correct depth ordering for
 * isometric (far tiles drawn first, near tiles drawn on top).
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  width: number,
  height: number,
  config: IsoConfig,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const halfW = config.tileWidth / 2;
  const halfH = config.tileHeight / 2;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row * width + col];
      const tileId = cell.possibleTiles[0]?.id ?? "unknown";
      const center = toScreen(col, row, config);

      // Draw a diamond (4 vertices of a rhombus).
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - halfH); // top
      ctx.lineTo(center.x + halfW, center.y); // right
      ctx.lineTo(center.x, center.y + halfH); // bottom
      ctx.lineTo(center.x - halfW, center.y); // left
      ctx.closePath();

      ctx.fillStyle = TILE_COLORS[tileId] ?? DEFAULT_COLOR;
      ctx.fill();

      // Subtle border to define grid lines.
      ctx.strokeStyle = "#00000033";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/**
 * Render an array of chunks onto the canvas.
 *
 * Uses a world-row sweep: iterates world rows from top to bottom, and within
 * each world row renders every chunk that contains it (sorted by cx). This
 * ensures correct isometric painter's-algorithm depth ordering — tiles that
 * appear "further away" are always drawn before tiles that appear "closer".
 *
 * Each cell's screen position is computed from its *world* coordinates
 * (cx * chunkSize + localCol, cy * chunkSize + localRow) so chunks tile
 * seamlessly in world space.
 */
export function renderChunks(
  ctx: CanvasRenderingContext2D,
  chunks: Chunk[],
  chunkSize: number,
  config: IsoConfig,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (chunks.length === 0) return;

  const halfW = config.tileWidth / 2;
  const halfH = config.tileHeight / 2;

  // Sort chunks by (cy, cx) so the row-sweep inner loop can skip non-matching
  // chunks quickly in a stable order.
  const sorted = [...chunks].sort((a, b) =>
    a.coord.cy !== b.coord.cy
      ? a.coord.cy - b.coord.cy
      : a.coord.cx - b.coord.cx,
  );

  // World row range spanned by all visible chunks.
  const minWorldRow = sorted[0].coord.cy * chunkSize;
  const maxWorldRow = sorted[sorted.length - 1].coord.cy * chunkSize + chunkSize - 1;

  for (let worldRow = minWorldRow; worldRow <= maxWorldRow; worldRow++) {
    for (const chunk of sorted) {
      const localRow = worldRow - chunk.coord.cy * chunkSize;

      // This chunk does not contain worldRow — skip.
      if (localRow < 0 || localRow >= chunkSize) continue;

      const worldColBase = chunk.coord.cx * chunkSize;

      for (let localCol = 0; localCol < chunkSize; localCol++) {
        const worldCol = worldColBase + localCol;
        const cell = chunk.grid[localRow * chunkSize + localCol];
        const tileId = cell.possibleTiles[0]?.id ?? "unknown";
        const center = toScreen(worldCol, worldRow, config);

        ctx.beginPath();
        ctx.moveTo(center.x, center.y - halfH); // top
        ctx.lineTo(center.x + halfW, center.y); // right
        ctx.lineTo(center.x, center.y + halfH); // bottom
        ctx.lineTo(center.x - halfW, center.y); // left
        ctx.closePath();

        ctx.fillStyle = TILE_COLORS[tileId] ?? DEFAULT_COLOR;
        ctx.fill();

        ctx.strokeStyle = "#00000033";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
