'use client'
import { useSyncExternalStore } from 'react'
import { MOBILE } from '@/lib/quality'

// Rendering the scene is expensive (two full-screen postprocessed canvases), so
// while the user is resizing or zooming the browser we pause the render loop:
// that frees the GPU/compositor to scale the static canvas smoothly instead of
// fighting a full re-render every frame. We resume once the gesture settles.
//
// Both full-page zoom (Cmd +/-, fires resize + devicePixelRatio change) and
// trackpad pinch-zoom (fires only visualViewport resize/scroll — no resize event
// at all, which is why earlier dpr-only fixes never touched it) are covered here.

let paused = false
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

const emit = () => { for (const l of listeners) l() }

function set(next: boolean) {
  if (paused === next) return
  paused = next
  emit()
}

// Mark an interaction tick: pause now, resume SETTLE_MS after the last tick.
const SETTLE_MS = 250
function poke() {
  set(true)
  clearTimeout(timer)
  timer = setTimeout(() => set(false), SETTLE_MS)
}

// On a phone/tablet the URL bar collapses and expands *as you scroll*, and that
// fires both 'resize' and visualViewport 'resize' mid-scroll. Poking on those
// froze every canvas for 250ms at a time while the user was scrolling — the scene
// is scroll-driven, so it stalled and then snapped, which reads as a stutter.
//
// A chrome move only changes the viewport *height*; a real zoom always moves
// devicePixelRatio (full-page zoom) or visualViewport.scale (pinch), and a real
// resize moves the width. So on mobile we pause only when one of those actually
// changed, and ignore height-only events. Desktop keeps the original behaviour.
let lastW = 0
let lastDpr = 0
let lastScale = 0
const readMetrics = (): [number, number, number] => [
  window.innerWidth,
  window.devicePixelRatio,
  window.visualViewport?.scale ?? 1,
]

function onResize() {
  if (!MOBILE) return poke()
  const [w, dpr, scale] = readMetrics()
  const changed = w !== lastW || dpr !== lastDpr || scale !== lastScale
  lastW = w
  lastDpr = dpr
  lastScale = scale
  if (changed) poke()
}

let installed = false
function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  ;[lastW, lastDpr, lastScale] = readMetrics()
  window.addEventListener('resize', onResize, { passive: true })
  // Pinch-zoom changes visualViewport.scale → fires its 'resize'. We deliberately
  // do NOT listen to visualViewport 'scroll' — the scene is scroll-driven and must
  // keep rendering while the page scrolls.
  window.visualViewport?.addEventListener('resize', onResize, { passive: true })
}

// React binding: returns true while a resize/zoom gesture is in flight.
export function useInteractionPaused(): boolean {
  install()
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => paused,
    () => false, // SSR: never paused
  )
}
