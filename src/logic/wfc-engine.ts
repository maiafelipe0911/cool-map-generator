/**
 * wfc-engine.ts
 * -------------
 * The core Wave Function Collapse algorithm.
 *
 * Three phases run in a loop until every cell is collapsed:
 *
 *   1. SUPERPOSITION (init) — every cell starts with all tiles as possibilities.
 *   2. OBSERVATION — pick the most-constrained cell and collapse it to one tile.
 *   3. PROPAGATION — ripple the new constraint outward via BFS, removing
 *      incompatible tiles from neighbors until the grid stabilizes.
 *
 * If propagation empties a cell's possibilities, that's a contradiction and
 * the run fails. For v1 we simply report the failure; backtracking can be
 * added later.
 */

import type { Cell, Direction, Grid, TileDefinition, WFCResult } from "./types";
import type { TileRegistry } from "./tile-registry";
import { lowestEntropyCell, weightedRandomTile } from "./entropy";

// ── Grid creation ────────────────────────────────────────────────────────────

/**
 * Create the initial grid in full superposition: every cell holds every
 * registered tile as a possibility.
 *
 * The grid is a flat row-major array — index a cell at (col, row) with
 * `grid[row * width + col]`.
 */
export function createGrid(
  width: number,
  height: number,
  registry: TileRegistry,
): Grid {
  const allTiles = registry.allTiles();
  const grid: Grid = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      grid.push({
        x: col,
        y: row,
        possibleTiles: [...allTiles], // each cell gets its own copy
        collapsed: false,
      });
    }
  }

  return grid;
}

// ── Observation (collapse) ───────────────────────────────────────────────────

/**
 * Collapse a cell to a single tile chosen by weighted random selection.
 * After this call the cell is "decided" and won't change again.
 *
 * An optional `boostMap` (tileId → multiplier) is forwarded to
 * `weightedRandomTile` so neighbour-affinity boosts can be applied
 * without the collapse function needing to know where they came from.
 */
export function collapse(cell: Cell, boostMap?: ReadonlyMap<string, number>): void {
  const chosen = weightedRandomTile(cell.possibleTiles, boostMap);
  cell.possibleTiles = [chosen];
  cell.collapsed = true;
}

// ── Neighbor lookup ──────────────────────────────────────────────────────────

/** A neighbor cell paired with the direction FROM the source TO the neighbor. */
interface Neighbor {
  cell: Cell;
  direction: Direction;
}

/** Direction offsets: [dx (col), dy (row)]. */
const DIRECTION_OFFSETS: Array<{ dir: Direction; dx: number; dy: number }> = [
  { dir: "north", dx: 0, dy: -1 },
  { dir: "south", dx: 0, dy: 1 },
  { dir: "east", dx: 1, dy: 0 },
  { dir: "west", dx: -1, dy: 0 },
];

/**
 * Return the (up to 4) in-bounds neighbors of a cell, each tagged with the
 * direction from the source cell to that neighbor.
 */
function getNeighbors(
  grid: Grid,
  width: number,
  height: number,
  cell: Cell,
): Neighbor[] {
  const neighbors: Neighbor[] = [];

  for (const { dir, dx, dy } of DIRECTION_OFFSETS) {
    const nx = cell.x + dx;
    const ny = cell.y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      neighbors.push({ cell: grid[ny * width + nx], direction: dir });
    }
  }

  return neighbors;
}

// ── Propagation (BFS constraint ripple) ──────────────────────────────────────

/**
 * Propagate constraints outward from `startCell` using breadth-first search.
 *
 * For every cell we dequeue, we look at each neighbor and ask:
 *   "Given what this cell *could still be*, which tiles are allowed next door?"
 *
 * We build a union of all compatible tiles (the "allowed set") and intersect
 * it with the neighbor's current possibilities. If the intersection shrinks
 * the neighbor's list, we enqueue it so the constraint keeps rippling.
 *
 * Returns `true` if propagation completed without contradiction, `false` if
 * any cell was left with zero possibilities.
 */
export function propagate(
  grid: Grid,
  width: number,
  height: number,
  startCell: Cell,
  registry: TileRegistry,
): boolean {
  // Queue of cells whose constraints need to propagate to neighbors.
  // We use an index pointer instead of Array.shift() to avoid O(n) cost.
  const queue: Cell[] = [startCell];
  let head = 0;

  // Track which cells are already in the queue by their flat index.
  const inQueue = new Set<number>();
  inQueue.add(startCell.y * width + startCell.x);

  while (head < queue.length) {
    const current = queue[head++];

    for (const { cell: neighbor, direction } of getNeighbors(grid, width, height, current)) {
      // Build the allowed set: union of all tiles compatible with each of
      // the current cell's remaining possibilities, in this direction.
      const allowedIds = new Set<string>();

      for (const tile of current.possibleTiles) {
        for (const compatible of registry.getTilesCompatibleWith(tile, direction)) {
          allowedIds.add(compatible.id);
        }
      }

      // Intersect: keep only neighbor tiles that appear in the allowed set.
      const before = neighbor.possibleTiles.length;
      neighbor.possibleTiles = neighbor.possibleTiles.filter(
        (t) => allowedIds.has(t.id),
      );

      // Contradiction: neighbor has no valid tiles left.
      if (neighbor.possibleTiles.length === 0) {
        return false;
      }

      // If we reduced the neighbor's options, enqueue it so the constraint
      // ripples further outward.
      if (neighbor.possibleTiles.length < before) {
        const idx = neighbor.y * width + neighbor.x;
        if (!inQueue.has(idx)) {
          inQueue.add(idx);
          queue.push(neighbor);
        }
      }
    }
  }

  return true;
}

// ── Main generation loop ─────────────────────────────────────────────────────

/**
 * Build a boost map for a cell based on its already-collapsed neighbours.
 *
 * For each collapsed neighbour, if the neighbour's tile has a `clusterBoost`
 * value > 1, we multiply the boost for that tile ID by `clusterBoost`. This
 * makes the current cell more likely to be the same type as its neighbours,
 * causing tiles to naturally cluster into larger regions (oceans, forests, etc.).
 *
 * Returns undefined when no boosting is needed (avoids allocating a Map in
 * the common case where no neighbours are collapsed yet).
 */
function buildBoostMap(
  cell: Cell,
  grid: Grid,
  width: number,
  height: number,
): ReadonlyMap<string, number> | undefined {
  let boostMap: Map<string, number> | undefined;

  for (const { cell: neighbor } of getNeighbors(grid, width, height, cell)) {
    if (!neighbor.collapsed || neighbor.possibleTiles.length === 0) continue;

    const neighborTile = neighbor.possibleTiles[0];
    const boost = neighborTile.clusterBoost ?? 1;
    if (boost <= 1) continue;

    // Only boost if this tile ID is still a possibility for the current cell.
    if (!cell.possibleTiles.some((t) => t.id === neighborTile.id)) continue;

    if (!boostMap) boostMap = new Map();
    boostMap.set(neighborTile.id, (boostMap.get(neighborTile.id) ?? 1) * boost);
  }

  return boostMap;
}

/**
 * Internal helper: run the observe→collapse→propagate loop on an existing grid.
 * Used by both `generate` (fresh grid) and `generateChunk` (pre-seeded grid).
 */
function runWFC(
  grid: Grid,
  width: number,
  height: number,
  registry: TileRegistry,
): WFCResult {
  for (;;) {
    const cell = lowestEntropyCell(grid);

    // All cells collapsed — we're done.
    if (cell === null) {
      return { ok: true, grid, width, height };
    }

    // Contradiction detected: a cell has zero possibilities.
    if (cell.possibleTiles.length === 0) {
      return {
        ok: false,
        reason: `Contradiction: cell (${cell.x}, ${cell.y}) has no possible tiles`,
      };
    }

    // Compute affinity boosts from already-collapsed neighbours before picking
    // a tile — this is what produces clusters (oceans, mountain ranges, etc.).
    const boostMap = buildBoostMap(cell, grid, width, height);
    collapse(cell, boostMap);

    if (!propagate(grid, width, height, cell, registry)) {
      return { ok: false, reason: "Contradiction during propagation" };
    }
  }
}

/**
 * Run the full WFC algorithm on a fresh grid and return the result.
 */
export function generate(
  width: number,
  height: number,
  registry: TileRegistry,
): WFCResult {
  return runWFC(createGrid(width, height, registry), width, height, registry);
}

// ── Multi-seed propagation ────────────────────────────────────────────────────

/**
 * Like `propagate`, but seeds the BFS queue with multiple start cells at once.
 * Used after applying border constraints so all edge constraints ripple inward
 * simultaneously rather than one-at-a-time.
 */
export function propagateMultiple(
  grid: Grid,
  width: number,
  height: number,
  startCells: Cell[],
  registry: TileRegistry,
): boolean {
  const queue: Cell[] = [...startCells];
  let head = 0;

  const inQueue = new Set<number>();
  for (const cell of startCells) {
    inQueue.add(cell.y * width + cell.x);
  }

  while (head < queue.length) {
    const current = queue[head++];

    for (const { cell: neighbor, direction } of getNeighbors(grid, width, height, current)) {
      const allowedIds = new Set<string>();

      for (const tile of current.possibleTiles) {
        for (const compatible of registry.getTilesCompatibleWith(tile, direction)) {
          allowedIds.add(compatible.id);
        }
      }

      const before = neighbor.possibleTiles.length;
      neighbor.possibleTiles = neighbor.possibleTiles.filter(
        (t) => allowedIds.has(t.id),
      );

      if (neighbor.possibleTiles.length === 0) {
        return false;
      }

      if (neighbor.possibleTiles.length < before) {
        const idx = neighbor.y * width + neighbor.x;
        if (!inQueue.has(idx)) {
          inQueue.add(idx);
          queue.push(neighbor);
        }
      }
    }
  }

  return true;
}

// ── Chunk generation with edge-seeding ───────────────────────────────────────

/**
 * Generate a chunk, optionally constrained by the collapsed border tiles of
 * already-generated neighbor chunks.
 *
 * `borderConstraints[dir]` is an array of collapsed TileDefinitions from the
 * neighbor in that direction. The array length must equal width (for north/south)
 * or height (for east/west).
 *
 * Retries up to MAX_RETRIES times on contradiction. Falls back to an
 * unconstrained generation if all retries fail.
 */
export function generateChunk(
  width: number,
  height: number,
  registry: TileRegistry,
  borderConstraints?: Partial<Record<Direction, TileDefinition[]>>,
): WFCResult {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const grid = createGrid(width, height, registry);

    // seedSet tracks flat indices of cells whose possibleTiles were narrowed
    // by border constraints. A corner cell can be constrained from two sides,
    // so we deduplicate with a Set.
    const seedSet = new Set<number>();

    if (borderConstraints) {
      // North neighbor's south edge → constrains our row 0.
      if (borderConstraints.north) {
        for (let col = 0; col < width; col++) {
          const neighborTile = borderConstraints.north[col];
          if (!neighborTile) continue;
          const allowed = new Set(
            registry.getTilesCompatibleWith(neighborTile, "south").map((t) => t.id),
          );
          const cell = grid[0 * width + col];
          cell.possibleTiles = cell.possibleTiles.filter((t) => allowed.has(t.id));
          seedSet.add(0 * width + col);
        }
      }

      // South neighbor's north edge → constrains our last row.
      if (borderConstraints.south) {
        for (let col = 0; col < width; col++) {
          const neighborTile = borderConstraints.south[col];
          if (!neighborTile) continue;
          const allowed = new Set(
            registry.getTilesCompatibleWith(neighborTile, "north").map((t) => t.id),
          );
          const cell = grid[(height - 1) * width + col];
          cell.possibleTiles = cell.possibleTiles.filter((t) => allowed.has(t.id));
          seedSet.add((height - 1) * width + col);
        }
      }

      // West neighbor's east edge → constrains our col 0.
      if (borderConstraints.west) {
        for (let row = 0; row < height; row++) {
          const neighborTile = borderConstraints.west[row];
          if (!neighborTile) continue;
          const allowed = new Set(
            registry.getTilesCompatibleWith(neighborTile, "east").map((t) => t.id),
          );
          const cell = grid[row * width + 0];
          cell.possibleTiles = cell.possibleTiles.filter((t) => allowed.has(t.id));
          seedSet.add(row * width + 0);
        }
      }

      // East neighbor's west edge → constrains our last col.
      if (borderConstraints.east) {
        for (let row = 0; row < height; row++) {
          const neighborTile = borderConstraints.east[row];
          if (!neighborTile) continue;
          const allowed = new Set(
            registry.getTilesCompatibleWith(neighborTile, "west").map((t) => t.id),
          );
          const cell = grid[row * width + (width - 1)];
          cell.possibleTiles = cell.possibleTiles.filter((t) => allowed.has(t.id));
          seedSet.add(row * width + (width - 1));
        }
      }
    }

    // Check if border application immediately produced a contradiction.
    if (grid.some((c) => c.possibleTiles.length === 0)) continue;

    // Propagate from all border-constrained cells simultaneously.
    if (seedSet.size > 0) {
      const seedCells = [...seedSet].map((idx) => grid[idx]);
      if (!propagateMultiple(grid, width, height, seedCells, registry)) continue;
    }

    // Run the normal observe/collapse loop on the pre-seeded grid.
    const result = runWFC(grid, width, height, registry);
    if (result.ok) return result;
    // Contradiction during WFC — retry with a fresh grid.
  }

  // All retries failed. Fall back to unconstrained generation.
  return generate(width, height, registry);
}
