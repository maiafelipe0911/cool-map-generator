/**
 * chunk-manager.ts
 * ----------------
 * On-demand chunk storage for the infinite world.
 *
 * The world is a grid of CHUNK_SIZE×CHUNK_SIZE cells. Each chunk is generated
 * lazily when it first comes into view and cached forever (within this session).
 *
 * When a chunk is generated, the manager checks whether any of its four
 * neighbors already exist. If so, the neighbor's border row/column (collapsed
 * tiles) is passed to `generateChunk` as edge-seeding constraints, ensuring
 * seamless tile transitions across chunk boundaries.
 */

import type { Chunk, ChunkCoord, Direction, TileDefinition } from "./types";
import type { TileRegistry } from "./tile-registry";
import { generateChunk } from "./wfc-engine";

export interface ChunkManager {
  /** Return the chunk at `coord`, generating it on first access. */
  getOrGenerate(coord: ChunkCoord): Chunk;
  /** Return the chunk at `coord` only if it already exists. */
  get(coord: ChunkCoord): Chunk | undefined;
  /**
   * Return all chunks that overlap the given world-cell bounding box,
   * generating any missing ones in chunk-row-major order (top-left to
   * bottom-right) so border constraints are applied from already-generated
   * neighbors.
   */
  getVisibleChunks(
    minCol: number,
    minRow: number,
    maxCol: number,
    maxRow: number,
  ): Chunk[];
}

/** Stable string key for a ChunkCoord. Works for negative values too. */
function chunkKey(coord: ChunkCoord): string {
  return `${coord.cx},${coord.cy}`;
}

export function createChunkManager(
  registry: TileRegistry,
  chunkSize: number,
): ChunkManager {
  const chunks = new Map<string, Chunk>();

  function get(coord: ChunkCoord): Chunk | undefined {
    return chunks.get(chunkKey(coord));
  }

  function getOrGenerate(coord: ChunkCoord): Chunk {
    const key = chunkKey(coord);
    const existing = chunks.get(key);
    if (existing) return existing;

    // Collect border constraints from any already-generated neighbors.
    const borderConstraints: Partial<Record<Direction, TileDefinition[]>> = {};

    const north = chunks.get(chunkKey({ cx: coord.cx, cy: coord.cy - 1 }));
    if (north) {
      // North neighbor's bottom row constrains our row 0.
      borderConstraints.north = Array.from({ length: chunkSize }, (_, col) => {
        return north.grid[(chunkSize - 1) * chunkSize + col].possibleTiles[0];
      });
    }

    const south = chunks.get(chunkKey({ cx: coord.cx, cy: coord.cy + 1 }));
    if (south) {
      // South neighbor's top row constrains our last row.
      borderConstraints.south = Array.from({ length: chunkSize }, (_, col) => {
        return south.grid[0 * chunkSize + col].possibleTiles[0];
      });
    }

    const west = chunks.get(chunkKey({ cx: coord.cx - 1, cy: coord.cy }));
    if (west) {
      // West neighbor's right column constrains our col 0.
      borderConstraints.west = Array.from({ length: chunkSize }, (_, row) => {
        return west.grid[row * chunkSize + (chunkSize - 1)].possibleTiles[0];
      });
    }

    const east = chunks.get(chunkKey({ cx: coord.cx + 1, cy: coord.cy }));
    if (east) {
      // East neighbor's left column constrains our last col.
      borderConstraints.east = Array.from({ length: chunkSize }, (_, row) => {
        return east.grid[row * chunkSize + 0].possibleTiles[0];
      });
    }

    const hasConstraints = Object.keys(borderConstraints).length > 0;
    const result = generateChunk(
      chunkSize,
      chunkSize,
      registry,
      hasConstraints ? borderConstraints : undefined,
    );

    // generateChunk guarantees a result (falls back to unconstrained on failure).
    if (!result.ok) {
      throw new Error(`Chunk generation failed at (${coord.cx},${coord.cy}): ${result.reason}`);
    }

    const chunk: Chunk = {
      coord,
      grid: result.grid,
      width: chunkSize,
      height: chunkSize,
    };
    chunks.set(key, chunk);
    return chunk;
  }

  function getVisibleChunks(
    minCol: number,
    minRow: number,
    maxCol: number,
    maxRow: number,
  ): Chunk[] {
    const minCx = Math.floor(minCol / chunkSize);
    const minCy = Math.floor(minRow / chunkSize);
    const maxCx = Math.floor(maxCol / chunkSize);
    const maxCy = Math.floor(maxRow / chunkSize);

    const visible: Chunk[] = [];
    // Generate in top-to-bottom, left-to-right order so that when a chunk is
    // generated, its north and west neighbors are already cached — maximising
    // the number of border constraints that can be applied.
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        visible.push(getOrGenerate({ cx, cy }));
      }
    }
    return visible;
  }

  return { get, getOrGenerate, getVisibleChunks };
}
