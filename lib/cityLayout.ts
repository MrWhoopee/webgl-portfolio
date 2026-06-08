/* Single source of truth for the descent geometry and the procedural city.
   The city is generated deterministically (seeded PRNG, computed once at module
   load) so it never drifts between renders and never trips the React-Compiler
   purity rules. ~20 "hero" towers are placed first; from each we derive the
   exact tear it must punch in the tilted lower plane, so the tower pierces
   precisely through its hole. The rest is a dense, multi-tier skyline. */

// ── Shared scene geometry ──
export const TILT    = 0.26          // plane tilt (≈15°)
export const UPPER_Y = 60            // upper plane world Y (reads as the hero floor)
export const LOWER_Y = -165          // lower plane world Y (5× the old gap below)
export const PLANE_Z = -80           // both planes' world Z
export const CITY_Y  = -300          // city ground world Y
export const CITY_Z  = -78           // city group world Z

const cosT = Math.cos(TILT)
const tanT = Math.tan(TILT)

// City footprint — kept well inside the lower plane so it never spills past
// the plane's edges in the distance (the plane is wider, ±220 × ±380).
export const HALF_X = 150
export const HALF_Z = 300
// Buildings no longer fade with distance, so cap how deep along -z they may spawn
// — anything past this would stick out beyond the torn plane's visible far edge.
const BUILD_DEPTH = -170

const PALETTE: [number, number, number][] = [
  [0.0, 0.95, 1.0],   // cyan
  [1.0, 0.17, 0.84],  // magenta
  [0.6, 0.36, 1.0],   // violet
  [1.0, 0.55, 0.10],  // amber (rare)
]

// Deterministic PRNG (mulberry32) — pure, repeatable, no Math.random.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Tier = { x: number; y: number; z: number; w: number; h: number; d: number; tint: [number, number, number]; band: number }
type Ant  = { x: number; y: number; z: number; h: number; tint: [number, number, number] }

function generate() {
  const rnd = mulberry32(0x1357acef)
  const tiers: Tier[] = []
  const ants:  Ant[]  = []
  const holes: [number, number, number][] = []
  const pick = (): [number, number, number] => PALETTE[rnd() < 0.1 ? 3 : Math.floor(rnd() * 3)]

  // A tower = stacked setback tiers from y=0 up to `top`, capped by an antenna.
  const tower = (x: number, z: number, w0: number, d0: number, top: number, tint: [number, number, number]) => {
    const n = 2 + Math.floor(rnd() * 3)
    let y = 0, w = w0, d = d0
    for (let s = 0; s < n; s++) {
      const h = (top / n) * (1 - s * 0.04)
      tiers.push({ x, y: y + h / 2, z, w, h, d, tint, band: rnd() })
      y += h
      w *= 0.66 + rnd() * 0.14
      d *= 0.66 + rnd() * 0.14
    }
    if (rnd() < 0.75) ants.push({ x, y: top, z, h: 8 + rnd() * 22, tint })
  }

  // The whole city must fit inside the lower plane's footprint (same size as
  // the plane: HALF_X × HALF_Z) and leave a clear corridor in front of the
  // camera (which sits near world z = +35; CITY_Z = -78).
  const CLEAR_Z = -45                              // world z; nothing built nearer
  const outside = (x: number, z: number) =>
    Math.abs(x) > HALF_X || Math.abs(z) > HALF_Z || z < BUILD_DEPTH || z + CITY_Z > CLEAR_Z

  // Hero towers: spread across the plane, pushed deep (away from the camera),
  // tall enough to break through the lower plane.
  const NHERO = 20
  for (let i = 0; i < NHERO; i++) {
    const x  = (rnd() - 0.5) * 2 * HALF_X
    const z  = -60 - rnd() * (-BUILD_DEPTH - 60)    // deep, but within the visible plane
    const w0 = 11 + rnd() * 8
    const d0 = 11 + rnd() * 8
    const top = 135 - (z + 2) * tanT + 42          // crosses the tilted plane + pokes through
    tower(x, z, w0, d0, top, pick())
    holes.push([x, (z + 2) / cosT, w0 * 0.8 + 4])  // tear flush against the tower
  }

  // Dense filler skyline — shorter, varied, kept below the plane.
  for (let gx = -11; gx <= 11; gx++)
    for (let gz = -12; gz <= 8; gz++) {
      if (rnd() < 0.16) continue
      const x = gx * 21 + (rnd() - 0.5) * 11
      const z = gz * 21 + (rnd() - 0.5) * 11 - 30
      if (outside(x, z)) continue                   // stay within the plane, clear the front
      const w0 = 7 + rnd() * 8
      const d0 = 7 + rnd() * 8
      const top = 16 + Math.pow(rnd(), 1.9) * 78
      tower(x, z, w0, d0, top, pick())
    }

  // Pack to typed arrays for instancing.
  const T = tiers.length, A = ants.length
  const tilePos = new Float32Array(T * 3), tileSize = new Float32Array(T * 3)
  const tileTint = new Float32Array(T * 3), tileBand = new Float32Array(T)
  tiers.forEach((b, i) => {
    tilePos.set([b.x, b.y, b.z], i * 3)
    tileSize.set([b.w, b.h, b.d], i * 3)
    tileTint.set(b.tint, i * 3)
    tileBand[i] = b.band
  })
  const antPos = new Float32Array(A * 3), antSize = new Float32Array(A * 3), antTint = new Float32Array(A * 3)
  ants.forEach((a, i) => {
    antPos.set([a.x, a.y + a.h / 2, a.z], i * 3)
    antSize.set([0.9, a.h, 0.9], i * 3)
    antTint.set(a.tint, i * 3)
  })

  return {
    tiles: { pos: tilePos, size: tileSize, tint: tileTint, band: tileBand, count: T },
    ants:  { pos: antPos, size: antSize, tint: antTint, count: A },
    holes,
  }
}

export const CITY = generate()
export const CITY_HOLES = CITY.holes
