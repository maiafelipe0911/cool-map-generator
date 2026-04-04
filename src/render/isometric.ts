/**
 * isometric.ts
 * ------------
 * Pure math for converting grid coordinates (col, row) into screen pixel
 * positions using an isometric projection.
 *
 * Isometric projection takes a flat 2D grid and tilts it so it looks 3D:
 *   - The x-axis goes down-right.
 *   - The y-axis goes down-left.
 *   - Each tile becomes a diamond (rhombus) on screen.
 *
 * The formulas:
 *   screenX = originX + (col - row) * (tileWidth / 2)
 *   screenY = originY + (col + row) * (tileHeight / 2)
 */

/** Configuration for the isometric projection. */
export interface IsoConfig {
  originX: number;
  originY: number;
  tileWidth: number;
  tileHeight: number;
}

/** A point in screen (pixel) space. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Convert a grid position (col, row) to a screen position (px).
 * The returned point is the CENTER of the diamond for that cell.
 */
export function toScreen(
  col: number,
  row: number,
  config: IsoConfig,
): ScreenPoint {
  return {
    x: config.originX + (col - row) * (config.tileWidth / 2),
    y: config.originY + (col + row) * (config.tileHeight / 2),
  };
}

/**
 * Convert a screen pixel position back to fractional grid coordinates.
 * This is the inverse of `toScreen` — useful for computing which world cells
 * are visible given the current camera and canvas size.
 *
 * The returned col/row are fractional; use Math.floor to get the cell index.
 *
 * Derivation:
 *   screenX - originX = (col - row) * halfW   → A = col - row
 *   screenY - originY = (col + row) * halfH   → B = col + row
 *   col = (A + B) / 2,  row = (B - A) / 2
 */
export function fromScreen(
  screenX: number,
  screenY: number,
  config: IsoConfig,
): { col: number; row: number } {
  const dx = (screenX - config.originX) / (config.tileWidth / 2);
  const dy = (screenY - config.originY) / (config.tileHeight / 2);
  return { col: (dx + dy) / 2, row: (dy - dx) / 2 };
}

/**
 * Compute sensible defaults so an NxN grid fits nicely on screen.
 *
 * Tiles use a 2:1 width-to-height ratio (standard isometric). The grid is
 * sized to fill ~80% of the viewport and centered horizontally, with the
 * top corner of the diamond near the top of the canvas.
 */
export function defaultConfig(
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number,
): IsoConfig {
  // An NxN isometric grid spans N * tileWidth horizontally and
  // N * tileHeight vertically. Fit within 80% of the viewport.
  const maxWidth = canvasWidth * 0.8;
  const maxHeight = canvasHeight * 0.8;

  // Derive tile size from the more restrictive axis.
  let tileWidth = Math.floor(maxWidth / gridSize);
  let tileHeight = Math.floor(tileWidth / 2); // 2:1 aspect ratio

  const tileHeightFromCanvas = Math.floor(maxHeight / gridSize);
  if (tileHeight > tileHeightFromCanvas) {
    tileHeight = tileHeightFromCanvas;
    tileWidth = tileHeight * 2;
  }

  // Origin: top-center of the diamond grid.
  const originX = canvasWidth / 2;
  const originY = (canvasHeight - gridSize * tileHeight) / 2;

  return { originX, originY, tileWidth, tileHeight };
}
