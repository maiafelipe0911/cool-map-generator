/**
 * tiles.ts
 * --------
 * Full terrain tile set for the infinite world. Replaces mock-tiles.ts.
 *
 * Ten tile types form a natural elevation gradient:
 *
 *   deep_water → water → sand → grass → forest / dirt / marsh
 *                                grass → hill → mountain → snow
 *
 * Socket compatibility follows the "one step away" rule: each tile can only
 * border tiles that are adjacent to it in the gradient above. No long-range
 * jumps (deep_water never touches grass, sand never touches mountain, etc.)
 *
 * clusterBoost makes tiles prefer to be near their own type, producing
 * recognisable regions: open oceans, continuous beaches, dense forests,
 * mountain ranges, and snowcaps rather than scattered noise.
 */

import type { TileDefinition } from "../logic/types";
import { TileRegistry } from "../logic/tile-registry";

// ── Tile definitions ─────────────────────────────────────────────────────────

/** Helper: all four sockets of a tile carry the same label (the tile's own id). */
function makeTile(
  id: string,
  weight: number,
  clusterBoost: number,
): TileDefinition {
  return {
    id,
    sockets: { north: id, south: id, east: id, west: id },
    weight,
    clusterBoost,
  };
}

export const DEEP_WATER = makeTile("deep_water", 1.0, 4.0);
export const WATER      = makeTile("water",      1.2, 3.0);
export const SAND       = makeTile("sand",        0.8, 2.0);
export const GRASS      = makeTile("grass",       1.5, 2.0);
export const FOREST     = makeTile("forest",      1.2, 2.5);
export const HILL       = makeTile("hill",        0.8, 2.0);
export const MOUNTAIN   = makeTile("mountain",    0.5, 3.0);
export const SNOW       = makeTile("snow",        0.4, 3.0);
export const MARSH      = makeTile("marsh",       0.5, 2.0);
export const DIRT       = makeTile("dirt",        0.7, 1.5);

// ── Registry factory ─────────────────────────────────────────────────────────

/**
 * Build a TileRegistry loaded with all ten terrain tiles and their
 * socket compatibility rules.
 *
 * The compatibility chain (reading left→right means "can be adjacent"):
 *
 *   deep_water ↔ deep_water, water
 *   water      ↔ water, sand, marsh
 *   sand       ↔ sand, grass, dirt
 *   grass      ↔ grass, forest, hill, dirt, marsh
 *   forest     ↔ forest, hill
 *   hill       ↔ hill, mountain
 *   mountain   ↔ mountain, snow
 *   snow       ↔ snow
 *   marsh      ↔ marsh              (also water↔marsh, grass↔marsh via above)
 *   dirt       ↔ dirt               (also sand↔dirt, grass↔dirt via above)
 *
 * All connections are symmetric — allowConnection("A","B") covers both
 * A-east-of-B and B-east-of-A.
 */
export function createTileRegistry(): TileRegistry {
  const registry = new TileRegistry();

  // Register all tiles.
  registry.register(DEEP_WATER);
  registry.register(WATER);
  registry.register(SAND);
  registry.register(GRASS);
  registry.register(FOREST);
  registry.register(HILL);
  registry.register(MOUNTAIN);
  registry.register(SNOW);
  registry.register(MARSH);
  registry.register(DIRT);

  // Elevation / terrain gradient connections.
  registry.allowConnection("deep_water", "deep_water");
  registry.allowConnection("deep_water", "water");

  registry.allowConnection("water", "water");
  registry.allowConnection("water", "sand");
  registry.allowConnection("water", "marsh");

  registry.allowConnection("sand", "sand");
  registry.allowConnection("sand", "grass");
  registry.allowConnection("sand", "dirt");

  registry.allowConnection("grass", "grass");
  registry.allowConnection("grass", "forest");
  registry.allowConnection("grass", "hill");
  registry.allowConnection("grass", "dirt");
  registry.allowConnection("grass", "marsh");

  registry.allowConnection("forest", "forest");
  registry.allowConnection("forest", "hill");

  registry.allowConnection("hill", "hill");
  registry.allowConnection("hill", "mountain");

  registry.allowConnection("mountain", "mountain");
  registry.allowConnection("mountain", "snow");

  registry.allowConnection("snow", "snow");

  // Self-connections for marsh and dirt (they also connect to others via
  // the rules above, since allowConnection is symmetric).
  registry.allowConnection("marsh", "marsh");
  registry.allowConnection("dirt",  "dirt");

  return registry;
}
