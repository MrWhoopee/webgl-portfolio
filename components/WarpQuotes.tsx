'use client'
import { useEffect, useRef } from 'react'
import { eggState } from '@/lib/egg'

/* Deep-space one-liners shown during the warp flight: each fades in, holds, then
   fades out, with quiet gaps between. Timed to the flight clock (warpElapsed),
   driven by rAF + direct DOM writes so it never re-renders per frame. */
const FADE = 1.4
const QUOTES: { start: number; dur: number; text: string }[] = [
  { start: 11, dur: 7,  text: 'Every atom in you was forged inside a dying star.' },
  { start: 22, dur: 7,  text: 'We are the cosmos, briefly aware of itself.' },
  { start: 33, dur: 7,  text: 'Out here, time forgets how to pass.' },
  { start: 44, dur: 7,  text: 'What you are seeking is also seeking you.' },
]

function elapsed() {
  return eggState.warpElapsed > 0.05
    ? eggState.warpElapsed
    : (performance.now() - eggState.warpAt) / 1000
}

export default function WarpQuotes() {
  const wrap = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLParagraphElement>(null)
  const shown = useRef(-1)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const w = wrap.current, p = text.current
      if (w && p) {
        const e = elapsed()
        let active = -1, op = 0
        for (let i = 0; i < QUOTES.length; i++) {
          const q = QUOTES[i]
          if (e >= q.start && e <= q.start + q.dur) {
            active = i
            const into = e - q.start
            op = Math.min(into / FADE, (q.dur - into) / FADE, 1)   // fade in / hold / fade out
            break
          }
        }
        if (active !== shown.current) { shown.current = active; p.textContent = active >= 0 ? QUOTES[active].text : '' }
        w.style.opacity = String(Math.max(0, op))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      {/* soft dark halo behind the text so it stays readable over the bright starfield */}
      <div
        ref={wrap}
        className="max-w-3xl px-16 py-12 text-center"
        style={{
          opacity: 0,
          background: 'radial-gradient(ellipse at center, rgba(2,3,14,0.78) 0%, rgba(2,3,14,0.5) 45%, rgba(2,3,14,0) 78%)',
        }}
      >
        <p
          ref={text}
          className="text-2xl font-light leading-relaxed md:text-4xl"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            color: '#f2feff',
            textShadow: '0 0 4px #000, 0 2px 8px #000, 0 0 22px #00f3ffcc, 0 0 46px #00f3ff55',
            letterSpacing: '0.04em',
          }}
        />
      </div>
    </div>
  )
}
