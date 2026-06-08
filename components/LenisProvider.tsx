'use client'
import { ReactLenis, useLenis } from 'lenis/react'
import { scrollState, emitScroll } from '@/lib/scroll'

// Dev-only: react-three-fiber still instantiates THREE.Clock under the hood, so
// three r0.184 logs its deprecation warning once per <Canvas>. Silence just that
// exact line so it doesn't flood the console; everything else logs normally.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const w = window as unknown as { __clockWarnPatched?: boolean }
  if (!w.__clockWarnPatched) {
    w.__clockWarnPatched = true
    const orig = console.warn.bind(console)
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) return
      orig(...args)
    }
  }
}

function LenisSync() {
  useLenis(({ scroll, progress, velocity }) => {
    scrollState.direction = velocity > 0.02 ? 1 : velocity < -0.02 ? -1 : 0
    scrollState.progress = progress
    scrollState.velocity = velocity
    scrollState.scrollY = scroll
    emitScroll()
  })
  return null
}

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }}>
      <LenisSync />
      {children}
    </ReactLenis>
  )
}
