/**
 * entropy.ts
 * ----------
 * Entropy helpers for the WFC observation step.
 *
 * In information theory, Shannon entropy measures "how uncertain" a
 * distribution is. For WFC with uniform tile weights the count of remaining
 * possibilities is a fine proxy — but we support weights here so future tile
 * sets can bias the output (e.g. "more grass than water").
 *
 * Shannon entropy formula (weighted):
 *   H = - Σ (p_i * log(p_i))   where p_i = weight_i / totalWeight
 *
 * For our purposes we compute it once per cell after each propagation round.
 */

import type { Cell, Grid, TileDefinition } from "./types";

/**
 * A weight function that replaces a tile's base `weight` for entropy and
 * tile-selection purposes. Used by the biome system to steer WFC toward
 * climatically appropriate tiles without violating socket constraints.
 */
export type WeightFn = (tile: TileDefinition) => number;

/**
 * Compute the Shannon entropy of a cell based on the weights of its remaining
 * possible tiles.
 *
 * Returns Infinity for uncollapsed cells with more than one tile (so they rank
 * higher than collapsed cells), and 0 for already-collapsed cells.
 *
 * Special cases:
 *   - 0 tiles remaining → -Infinity  (contradiction, handled by the engine)
 *   - 1 tile remaining  → 0          (already determined, will be collapsed next)
 *
 * An optional `weightFn` replaces `tile.weight` in the formula when provided
 * (used by the biome system).
 */
export function entropy(cell: Cell, weightFn?: WeightFn): number {
  const n = cell.possibleTiles.length;

  if (n === 0) return -Infinity; // Contradiction — caller should detect this.
  if (n === 1) return 0;         // Only one option, effectively collapsed.

  // Weighted Shannon entropy.
  const getW = (t: TileDefinition) => weightFn ? weightFn(t) : t.weight;
  const totalWeight = cell.possibleTiles.reduce((sum, t) => sum + getW(t), 0);

  return cell.possibleTiles.reduce((h, tile) => {
    const p = getW(tile) / totalWeight;
    return h - p * Math.log2(p);
  }, 0);
}

/**
 * Find the uncollapsed cell with the lowest entropy in the grid.
 *
 * Tie-breaking is random — this is important so WFC doesn't always start
 * from the same corner and produce repetitive output.
 *
 * Returns null if all cells are already collapsed (generation is done).
 */
export function lowestEntropyCell(grid: Grid): Cell | null {
  let minEntropy = Infinity;
  let candidates: Cell[] = [];

  for (const cell of grid) {
    if (cell.collapsed) continue;

    const h = entropy(cell);

    if (h < minEntropy) {
      minEntropy = h;
      candidates = [cell];
    } else if (h === minEntropy) {
      candidates.push(cell);
    }
  }

  if (candidates.length === 0) return null; // All cells are collapsed.

  // Random tie-break: pick any of the equally-uncertain cells.
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Weighted random selection from a tile list.
 *
 * Used during the Collapse step to pick a single tile from the remaining
 * possibilities of the chosen cell, respecting each tile's weight.
 *
 * An optional `boostMap` (tileId → multiplier) lets the caller increase
 * a tile's effective weight based on context — for example, to make tiles
 * more likely when the same tile type is already present in neighboring cells
 * (see `clusterBoost` on TileDefinition and the collapse step in wfc-engine.ts).
 *
 * An optional `weightFn` replaces `tile.weight` as the base weight. The
 * `boostMap` multiplier is applied on top: `effectiveWeight = weightFn(tile) * boost`.
 *
 * Tiles with higher effective weight are proportionally more likely to be selected.
 */
export function weightedRandomTile(
  tiles: TileDefinition[],
  boostMap?: ReadonlyMap<string, number>,
  weightFn?: WeightFn,
): TileDefinition {
  const effectiveWeight = (t: TileDefinition) =>
    (weightFn ? weightFn(t) : t.weight) * (boostMap?.get(t.id) ?? 1);

  const totalWeight = tiles.reduce((sum, t) => sum + effectiveWeight(t), 0);
  let roll = Math.random() * totalWeight;

  for (const tile of tiles) {
    roll -= effectiveWeight(tile);
    if (roll <= 0) return tile;
  }

  // Fallback (floating-point edge case): return last tile.
  return tiles[tiles.length - 1];
}
