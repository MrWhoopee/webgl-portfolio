'use client'
import { useSyncExternalStore } from 'react'

/* The core easter egg. Click the neutron core: each hit shakes the screen and
   heats the core a notch — blue → yellow → orange → red, spread across 50 clicks.
   On the 50th click it's fully red and detonates, warping into a hidden space
   scene. Once detonated
   everything else is locked out until a full page reload — both the normal site
   and, before the first detonation, the secret scene itself. State is
   module-level + pub/sub, exactly like scrollState, so any canvas or DOM
   component can react. */

export type EggPhase =
  | 'idle'       // clicking: the core heats up toward red
  | 'exploding'  // 25th click: core detonates (~0.7s) in the main scene
  | 'warp'       // hurtling through space to the soundtrack
  | 'galaxy'     // arrival: the Milky Way revealed

export const CLICKS_BLOW = 80        // clicks to cycle the core through its colours + detonate
export const EXPLODE_HOLD_MS = 2200  // hold on the detonation before the warp/track start
export const WARP_SECONDS = 59       // length of the warp jump (then we drop out)
const COOL_DELAY_MS = 3000           // idle time before the core starts cooling
const COOL_FULL_MS  = 6000           // time to bleed a fully-heated core back to blue

export const eggState = {
  clicks: 0,
  heatBase: 0,         // 0..1 heat captured at the last click (cooldown is read from here)
  lastClick: 0,        // performance.now() of the last click — drives the cooldown
  phase: 'idle' as EggPhase,
  shake: 0,            // 0..1 impulse, decayed each frame by CameraRig
  explodeAt: 0,        // performance.now() when the core detonated
  warpAt: 0,           // performance.now() when the warp/flight began
  warpElapsed: 0,      // seconds into the starfall track (written by AudioManager)
}

// 0..1 heat — drives the core's blue→red colour ramp. Clicks heat it; after a
// few idle seconds it cools back toward blue. Pure function of time, so the
// per-frame reader animates the cooldown for free.
export function heat() {
  let h = eggState.heatBase
  const since = performance.now() - eggState.lastClick
  if (eggState.phase === 'idle' && since > COOL_DELAY_MS)
    h -= (since - COOL_DELAY_MS) / COOL_FULL_MS
  return Math.min(1, Math.max(0, h))
}

type Listener = () => void
const listeners = new Set<Listener>()

export function onEgg(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
function emit() { for (const fn of listeners) fn() }

export function isLocked(p: EggPhase = eggState.phase) {
  return p === 'exploding' || p === 'warp' || p === 'galaxy'
}

/* Registers one click on the core: heats it up and, on the last click, detonates. */
export function coreClick() {
  if (eggState.phase !== 'idle') return
  eggState.heatBase = heat() + 1 / CLICKS_BLOW   // resume from however far it had cooled
  eggState.lastClick = performance.now()
  eggState.clicks++
  eggState.shake = Math.min(1, eggState.shake + 0.5)

  if (eggState.heatBase >= 1) {
    eggState.heatBase = 1
    eggState.phase = 'exploding'
    eggState.explodeAt = performance.now()
    // hold on the detonation for a beat, THEN start the track + warp flight
    setTimeout(() => {
      eggState.phase = 'warp'
      eggState.warpAt = performance.now()
      emit()
    }, EXPLODE_HOLD_MS)
  }
  emit()
}

/* Dropping out of warp on arrival — flips to the final phase and notifies. */
export function arrive() {
  if (eggState.phase !== 'warp') return
  eggState.phase = 'galaxy'
  emit()
}

/* React subscription — re-renders a component whenever the phase changes. */
export function useEggPhase(): EggPhase {
  return useSyncExternalStore(onEgg, () => eggState.phase, () => 'idle')
}
