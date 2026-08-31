'use client'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { dprCap } from '@/lib/quality'

// Keeps the render resolution pinned to the pixel budget (see lib/quality.ts) as
// the window changes size. Without this the dpr cap is frozen at the value from
// the first paint, so growing the window — or zooming out, which enlarges the CSS
// viewport — would balloon the framebuffer and the postprocessing render targets.
//
// Reallocating those GPU render targets is the single most expensive thing here,
// so we must NOT do it on every resize/zoom tick: a continuous browser zoom fires
// a stream of resize + devicePixelRatio events, and reacting to each one would
// reallocate the whole framebuffer + bloom mip chain every frame and stutter hard.
// Instead we wait for the gesture to settle, then apply once — and skip the call
// entirely when the effective dpr hasn't actually changed.
const SETTLE_MS = 200

export default function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastEff = -1

    // Resolve the budget tuple against the current devicePixelRatio the same way
    // R3F would, so we can dedupe on the actual scalar that would be applied.
    const effectiveDpr = () => {
      const [min, max] = dprCap()
      return Math.min(Math.max(min, window.devicePixelRatio), max)
    }

    const commit = () => {
      const eff = effectiveDpr()
      if (eff === lastEff) return // no-op → skip the render-target reallocation
      lastEff = eff
      setDpr(eff)
    }

    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(commit, SETTLE_MS)
    }

    // devicePixelRatio changes (browser zoom, dragging between monitors) don't
    // always fire 'resize', so watch the current dppx via matchMedia and
    // re-subscribe after each change since the matched value moves with it.
    let mql: MediaQueryList | null = null
    const onDprChange = () => {
      schedule()
      watchDpr()
    }
    const watchDpr = () => {
      mql?.removeEventListener('change', onDprChange)
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mql.addEventListener('change', onDprChange)
    }

    commit() // apply the initial budget immediately — no gesture in progress
    watchDpr()
    window.addEventListener('resize', schedule)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', schedule)
      mql?.removeEventListener('change', onDprChange)
    }
  }, [setDpr])

  return null
}
