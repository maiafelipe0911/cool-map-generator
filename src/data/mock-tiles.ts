/**
 * mock-tiles.ts
 * -------------
 * Defines three terrain tile types (Water, Sand, Grass) and their socket
 * compatibility rules. This is the dataset the WFC engine uses to generate maps.
 *
 * Socket compatibility creates natural terrain transitions:
 *   Water <-> Sand <-> Grass
 * Water and Grass can never be directly adjacent — sand always separates them.
 */

import type { TileDefinition } from "../logic/types";
import { TileRegistry } from "../logic/tile-registry";

export const WATER: TileDefinition = {
  id: "water",
  sockets: { north: "water", south: "water", east: "water", west: "water" },
  weight: 1,
};

export const SAND: TileDefinition = {
  id: "sand",
  sockets: { north: "sand", south: "sand", east: "sand", west: "sand" },
  weight: 1,
};

export const GRASS: TileDefinition = {
  id: "grass",
  sockets: { north: "grass", south: "grass", east: "grass", west: "grass" },
  weight: 1,
};

/**
 * Build a TileRegistry pre-loaded with the three terrain tiles and their
 * adjacency rules.
 *
 * Allowed connections:
 *   water <-> water   (ocean can border ocean)
 *   water <-> sand    (beach transition)
 *   sand  <-> sand    (desert can border desert)
 *   sand  <-> grass   (shore/field transition)
 *   grass <-> grass   (fields can border fields)
 *
 * NOT allowed:
 *   water <-> grass   (no abrupt ocean-to-forest)
 */
export function createMockRegistry(): TileRegistry {
  const registry = new TileRegistry();

  registry.register(WATER);
  registry.register(SAND);
  registry.register(GRASS);

  registry.allowConnection("water", "water");
  registry.allowConnection("water", "sand");
  registry.allowConnection("sand", "sand");
  registry.allowConnection("sand", "grass");
  registry.allowConnection("grass", "grass");

  return registry;
}
