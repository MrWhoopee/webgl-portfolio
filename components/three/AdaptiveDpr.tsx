'use client'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { dprCap } from '@/lib/quality'

// Keeps the render resolution pinned to the pixel budget (see lib/quality.ts) as
// the window changes size. Without this the dpr cap is frozen at the value from
// the first paint, so growing the window — or zooming out, which enlarges the CSS
// viewport — would balloon the framebuffer and the postprocessing render targets
// again. Recomputing on resize + devicePixelRatio change holds the framebuffer at
// a stable size on any monitor and at any zoom level.
export default function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr)

  useEffect(() => {
    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      // Coalesce bursts of resize events into a single dpr update per frame.
      raf = requestAnimationFrame(() => setDpr(dprCap()))
    }

    // devicePixelRatio changes (browser zoom, dragging between monitors) don't
    // always fire 'resize', so watch the current dppx via matchMedia and
    // re-subscribe after each change since the matched value moves with it.
    let mql: MediaQueryList | null = null
    const onDprChange = () => {
      apply()
      watchDpr()
    }
    const watchDpr = () => {
      mql?.removeEventListener('change', onDprChange)
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mql.addEventListener('change', onDprChange)
    }

    apply()
    watchDpr()
    window.addEventListener('resize', apply)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', apply)
      mql?.removeEventListener('change', onDprChange)
    }
  }, [setDpr])

  return null
}
