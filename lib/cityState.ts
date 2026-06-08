// Shared materialization progress for the cyberpunk city (0 → 1). Advanced once
// per frame by CyberCity from scroll position, on a fixed ~2.5s timeline so the
// towers "compile" at a steady pace regardless of scroll speed. Every sub-scene
// (buildings, tears, shards, sky cars, spires) sequences off this single value.
export const cityState = { build: 0 }

// Scroll progress at which the city starts compiling — lines up exactly with the
// 01/about section (camera keyframe ≈0.306), so nothing builds before you arrive.
export const BUILD_TRIGGER = 0.3
// Seconds for a full 0 → 1 compile (the matrix code phase the user sees).
export const BUILD_TIME = 2.6
