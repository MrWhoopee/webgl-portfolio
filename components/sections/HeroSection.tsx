'use client'
import { useEffect, useRef } from 'react'

const glow = (color: string) => ({
  color,
  textShadow: `0 0 8px ${color}cc, 0 0 22px ${color}66`,
})

export default function HeroSection() {
  const lineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = lineRef.current
    if (!el) return
    let on = true
    const id = setInterval(() => { el.style.opacity = (on = !on) ? '1' : '0' }, 530)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="h-screen flex flex-col justify-center px-10 md:px-24 relative">
      <div className="max-w-3xl">
        <p
          className="text-sm tracking-[0.3em] uppercase mb-4"
          style={glow('#EC4899')}
        >
          Full-Stack Developer
        </p>

        <h1
          className="text-6xl md:text-8xl font-bold leading-none tracking-tight text-white mb-6"
          style={{ textShadow: '0 0 40px rgba(255,255,255,0.18)' }}
        >
          Artemii
          <span ref={lineRef} style={glow('#7C3AED')}>_</span>
        </h1>

        <p
          className="text-xl md:text-2xl font-light text-slate-300 max-w-xl leading-relaxed"
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          Building modern web experiences with{' '}
          <span style={glow('#EC4899')}>Next.js</span>,{' '}
          <span style={glow('#7C3AED')}>WebGL</span> and{' '}
          <span style={glow('#EC4899')}>React Three Fiber</span>.
        </p>

        <div
          className="mt-12 flex items-center gap-3 text-slate-500 text-sm"
          style={{ fontFamily: 'Space Mono, monospace' }}
        >
          <span>scroll to explore</span>
          <span className="block w-12 h-px" style={{ background: '#7C3AED' }} />
          <span style={glow('#7C3AED')}>↓</span>
        </div>
      </div>
    </section>
  )
}
