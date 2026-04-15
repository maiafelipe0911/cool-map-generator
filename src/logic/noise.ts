/** Bilinear interpolation helper. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Returns a seedable hasher that maps any integer (x, y) pair to a stable
 * float in [0, 1). Same seed + same (x, y) always yields the same value —
 * essential for deterministic chunk regeneration on revisit.
 *
 * Uses Math.imul for correct 32-bit integer multiplication.
 */
export function createHasher(seed: number): (x: number, y: number) => number {
  return (x: number, y: number): number => {
    let n = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1540483477);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  };
}

/**
 * Smooth 2D value noise, returns [0, 1].
 *
 * Algorithm:
 *   1. Find the grid cell containing (x, y) at the given scale.
 *   2. Compute smoothstep fractional offsets within the cell.
 *   3. Hash the four corners of the cell.
 *   4. Bilinearly interpolate the four corner values.
 */
export function valueNoise2D(
  x: number,
  y: number,
  scale: number,
  hasher: (x: number, y: number) => number,
): number {
  const ix = Math.floor(x / scale);
  const iy = Math.floor(y / scale);
  const fx = x / scale - ix;
  const fy = y / scale - iy;

  // Smoothstep: removes discontinuities at cell boundaries.
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const v00 = hasher(ix,     iy);
  const v10 = hasher(ix + 1, iy);
  const v01 = hasher(ix,     iy + 1);
  const v11 = hasher(ix + 1, iy + 1);

  return lerp(lerp(v00, v10, ux), lerp(v01, v11, ux), uy);
}

/**
 * Fractal Brownian Motion — layers multiple octaves of valueNoise2D at
 * increasing frequency and decreasing amplitude for richer spatial variation.
 * Returns [0, 1].
 *
 * 2–4 octaves is enough for biome-scale features. Phase 5 uses octaves=3
 * with scale=180–200 for continent-sized temperature and moisture regions.
 */
export function fbm2D(
  x: number,
  y: number,
  scale: number,
  octaves: number,
  hasher: (x: number, y: number) => number,
): number {
  let sum = 0;
  let maxValue = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise2D(x * frequency, y * frequency, scale, hasher);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return sum / maxValue;
}
