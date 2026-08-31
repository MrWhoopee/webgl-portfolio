'use client'
import { useEffect, useState } from 'react'
import { targetDprFor, targetDpr } from '@/lib/quality'

// Single source of truth for canvas render dpr, fed to each <Canvas dpr={...}>.
//
// It tracks the layout viewport via a ResizeObserver on <html> (which fires on
// resize AND zoom, unlike the window 'resize' event that misses trackpad pinch),
// and recomputes the budgeted dpr from that size. Feeding R3F through the dpr prop
// — rather than a separate setDpr call — avoids the race where R3F's own resize
// and an external setDpr fight, briefly building a giant framebuffer on zoom-out.
export function useBudgetDpr(): number {
  const [dpr, setDpr] = useState<number>(() => targetDpr())

  useEffect(() => {
    const el = document.documentElement
    const update = () => setDpr(targetDprFor(el.clientWidth, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return dpr
}
