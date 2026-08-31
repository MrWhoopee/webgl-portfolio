'use client'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { targetDpr } from '@/lib/quality'

// Keeps the render dpr in sync with the pixel budget (see lib/quality.ts) as the
// window changes size or zoom. targetDpr() is built so the framebuffer stays a
// constant physical size across zoom levels, so this normally re-applies the same
// canvas dimensions and the postprocessing render targets are not reallocated.
//
// We still debounce: a real drag-resize does change the framebuffer, and firing a
// reallocation on every intermediate size would stutter. Applying once the
// gesture settles (and skipping no-op dpr changes) keeps it smooth.
const SETTLE_MS = 200

export default function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = -1

    const commit = () => {
      const dpr = targetDpr()
      if (dpr === last) return
      last = dpr
      setDpr(dpr)
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
