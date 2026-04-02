/**
 * types.ts
 * --------
 * All shared data types for the WFC engine. Keeping types in one place makes
 * the algorithm code easier to follow and avoids circular imports.
 */

// The four cardinal directions we use for tile adjacency checks.
export type Direction = "north" | "south" | "east" | "west";

/**
 * A Socket is just a string label that lives on one edge of a tile.
 * Two tiles can be placed next to each other only when their facing sockets
 * are compatible (see TileRegistry.canConnect).
 *
 * Example: a "water" socket on the east side of tile A must face a socket
 * that is compatible with "water" on the west side of tile B.
 */
export type Socket = string;

/**
 * A TileDefinition is the static description of a tile type.
 * It never changes during generation — it's read-only configuration.
 *
 * @property id      - Unique identifier, also used by the renderer to pick a color.
 * @property sockets - One socket label per cardinal direction.
 * @property weight  - Relative probability of this tile being chosen during
 *                     collapse. Higher = more likely. Default 1.
 */
export interface TileDefinition {
  readonly id: string;
  readonly sockets: Record<Direction, Socket>;
  readonly weight: number;
}

/**
 * A Cell represents one position in the WFC grid.
 * It starts in "superposition" (all tiles possible) and collapses to a single
 * tile when the algorithm picks it.
 *
 * @property x             - Column index (0-based, left to right).
 * @property y             - Row index (0-based, top to bottom).
 * @property possibleTiles - The remaining valid tile definitions for this cell.
 *                           Starts as the full tile set; shrinks during propagation.
 * @property collapsed     - True once this cell has been fixed to a single tile.
 */
export interface Cell {
  readonly x: number;
  readonly y: number;
  possibleTiles: TileDefinition[];
  collapsed: boolean;
}

/**
 * The Grid is a flat row-major array of Cells.
 * Access a cell at (col, row) with: grid[row * width + col]
 *
 * We store it flat (not as a 2D array) so we can easily iterate and index
 * without nested loops in the hot path of the propagation algorithm.
 */
export type Grid = Cell[];

/**
 * The result of a complete WFC run.
 * If the algorithm reaches a contradiction (a cell ends up with zero
 * possibilities) it returns { ok: false }.
 */
export type WFCResult =
  | { ok: true; grid: Grid; width: number; height: number }
  | { ok: false; reason: string };
