/**
 * biomes.ts
 * ---------
 * Biome definitions and weight functions for the infinite world.
 *
 * Two independent noise layers define climate at every world position:
 *   - Temperature: fbm2D(col, row, 200, 3, tempHasher) → 0 (cold) to 1 (hot)
 *   - Moisture:    fbm2D(col, row, 180, 3, moistHasher) → 0 (dry)  to 1 (wet)
 *
 * These two values map to one of six biomes. Each biome carries per-tile
 * weight multipliers. The multipliers are applied to a tile's base `weight`
 * during WFC collapse, biasing tile selection without ever zeroing a tile out
 * (defaultWeight: 0.1 keeps every tile possible everywhere, preventing
 * contradictions at biome boundaries).
 *
 * Final effective weight formula:
 *   effectiveWeight = tile.weight × biomeMultiplier × clusterBoost
 */

import type { TileDefinition } from "../logic/types";
import type { CellWeightFn } from "../logic/wfc-engine";
import { createHasher, fbm2D } from "../logic/noise";

// ── Biome definition ─────────────────────────────────────────────────────────

export interface BiomeDefinition {
  readonly id: string;
  /** Per-tile weight multipliers. Unlisted tiles receive `defaultWeight`. */
  readonly weights: Readonly<Record<string, number>>;
  /** Multiplier applied to tiles not listed in `weights`. Must be > 0. */
  readonly defaultWeight: number;
}

// ── The six biomes ────────────────────────────────────────────────────────────

const OCEAN: BiomeDefinition = {
  id: "ocean",
  weights: { deep_water: 4.0, water: 3.0 },
  defaultWeight: 0.1,
};

const TROPICAL: BiomeDefinition = {
  id: "tropical",
  weights: { sand: 3.0, water: 2.5, grass: 2.0 },
  defaultWeight: 0.1,
};

const TEMPERATE: BiomeDefinition = {
  id: "temperate",
  weights: { grass: 3.0, forest: 3.0, dirt: 2.0 },
  defaultWeight: 0.1,
};

const ARID: BiomeDefinition = {
  id: "arid",
  weights: { sand: 3.5, dirt: 3.0, hill: 2.0 },
  defaultWeight: 0.1,
};

const TUNDRA: BiomeDefinition = {
  id: "tundra",
  weights: { snow: 4.0, mountain: 3.0, hill: 2.0 },
  defaultWeight: 0.1,
};

const HIGHLAND: BiomeDefinition = {
  id: "highland",
  weights: { hill: 3.5, mountain: 3.0, grass: 1.5 },
  defaultWeight: 0.1,
};

// ── Biome classifier ──────────────────────────────────────────────────────────

/**
 * Classify a world position into a biome given noise-derived climate values.
 *
 * Priority order matters:
 *   1. Ocean first — high moisture dominates regardless of temperature.
 *   2. Tropical before Tundra — a hot+wet cell is tropical, not tundra.
 *   3. Tundra before Arid — cold+dry = tundra, not desert.
 *   4. Arid / Highland are mid-temperature specialisations.
 *   5. Temperate is the catch-all.
 */
export function biomeAt(temperature: number, moisture: number): BiomeDefinition {
  if (moisture > 0.75)                                              return OCEAN;
  if (temperature > 0.6 && moisture >= 0.5)                       return TROPICAL;
  if (temperature < 0.3)                                           return TUNDRA;
  if (temperature > 0.5 && moisture < 0.3)                        return ARID;
  if (temperature >= 0.2 && temperature <= 0.5 && moisture < 0.4) return HIGHLAND;
  return TEMPERATE;
}

// ── Weight function factory ───────────────────────────────────────────────────

/**
 * Create a `CellWeightFn` that steers WFC toward biome-appropriate tiles.
 *
 * The returned function is called once per cell collapse with the tile being
 * considered and the cell's absolute world coordinates. It:
 *   1. Samples temperature and moisture noise at that world position.
 *   2. Classifies the position into a biome.
 *   3. Returns `tile.weight × biomeMultiplier` — the biome-adjusted base weight.
 *      The engine then multiplies by `clusterBoost` on top.
 *
 * `seed` is XOR'd with two constants so temperature and moisture fields are
 * statistically independent even though both derive from the same master seed.
 */
export function createBiomeWeightFn(seed: number): CellWeightFn {
  const tempHasher  = createHasher(seed ^ 0xdeadbeef);
  const moistHasher = createHasher(seed ^ 0xcafebabe);

  return (tile: TileDefinition, worldCol: number, worldRow: number): number => {
    const temperature = fbm2D(worldCol, worldRow, 200, 3, tempHasher);
    const moisture    = fbm2D(worldCol, worldRow, 180, 3, moistHasher);
    const biome = biomeAt(temperature, moisture);
    const multiplier = biome.weights[tile.id] ?? biome.defaultWeight;
    return tile.weight * multiplier;
  };
}
