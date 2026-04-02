/**
 * tile-registry.ts
 * ----------------
 * Holds all registered TileDefinitions and the single source of truth for
 * socket compatibility.
 *
 * Separating this from the engine means you can swap out the ruleset (e.g.
 * load from JSON) without touching the WFC algorithm.
 */

import type { Direction, Socket, TileDefinition } from "./types";

/**
 * Returns the direction that faces the given direction.
 * North faces South, East faces West, and vice-versa.
 * Used during propagation to check that two neighboring tiles are mutually
 * compatible on the shared edge.
 */
export function opposite(dir: Direction): Direction {
  const map: Record<Direction, Direction> = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
  };
  return map[dir];
}

/**
 * TileRegistry manages the known tile definitions and the rules that say
 * which sockets may touch each other.
 *
 * The compatibility map is: compatibleSockets[socketA] = Set of sockets that
 * may appear on the facing edge of an adjacent tile.
 */
export class TileRegistry {
  private tiles: Map<string, TileDefinition> = new Map();

  /**
   * socketCompatibility[socketA] is the set of socket labels that are allowed
   * to face socketA on an adjacent tile's opposing edge.
   *
   * Example: if socketCompatibility["water"] contains "sand", then a tile
   * whose east socket is "water" may sit next to a tile whose west socket is
   * "sand".
   */
  private socketCompatibility: Map<Socket, Set<Socket>> = new Map();

  // --- Registration ----------------------------------------------------------

  /** Add a tile definition to the registry. */
  register(tile: TileDefinition): this {
    if (this.tiles.has(tile.id)) {
      throw new Error(`Tile "${tile.id}" is already registered.`);
    }
    this.tiles.set(tile.id, tile);
    return this;
  }

  /**
   * Declare that socketA and socketB may face each other.
   * This is symmetric: allowing A↔B also allows B↔A.
   */
  allowConnection(socketA: Socket, socketB: Socket): this {
    this.addCompat(socketA, socketB);
    this.addCompat(socketB, socketA);
    return this;
  }

  private addCompat(from: Socket, to: Socket): void {
    if (!this.socketCompatibility.has(from)) {
      this.socketCompatibility.set(from, new Set());
    }
    this.socketCompatibility.get(from)!.add(to);
  }

  // --- Queries ---------------------------------------------------------------

  /** Return all registered tile definitions as an array. */
  allTiles(): TileDefinition[] {
    return Array.from(this.tiles.values());
  }

  /**
   * canConnect answers the core adjacency question:
 * "Can a tile with `socketOnThisSide` sit next to a tile with `socketOnOtherSide`?"
   *
   * It checks if socketOnOtherSide is in the compatibility set for socketOnThisSide.
   */
  canConnect(socketOnThisSide: Socket, socketOnOtherSide: Socket): boolean {
    return (
      this.socketCompatibility.get(socketOnThisSide)?.has(socketOnOtherSide) ??
      false
    );
  }

  /**
   * Given a tile and a direction, return all registered tiles whose socket on
   * the *opposite* direction is compatible with this tile's socket on `dir`.
   *
   * This is the query the propagation loop calls for each neighbor.
   *
   * Example: getTilesCompatibleWith(waterTile, "east")
   *   → all tiles T where T.sockets.west is compatible with waterTile.sockets.east
   */
  getTilesCompatibleWith(tile: TileDefinition, dir: Direction): TileDefinition[] {
    const thisSocket = tile.sockets[dir];
    const neighborDir = opposite(dir);

    return this.allTiles().filter((candidate) =>
      this.canConnect(thisSocket, candidate.sockets[neighborDir])
    );
  }
}
