'use client'
import { useEffect, useRef, useState } from 'react'
import { onScroll } from '@/lib/scroll'
import { heat, isLocked, useEggPhase } from '@/lib/egg'

/* The plaque beneath the neutron core. It reads the same heat the shader does,
   so its colour IS the core's current colour, and escalates its warning as the
   core is clicked toward detonation: stable → don't-touch → losing stability →
   needs cooling → danger (blinking). See [[core_easter_egg]]. */

type Stage = 'stable' | 'losing' | 'unstable' | 'danger'

const COPY: Record<Stage, string> = {
  stable:   'CORE STABLE — DO NOT TOUCH',
  losing:   'CORE LOSING STABILITY',
  unstable: 'CORE UNSTABLE — COOLING REQUIRED',
  danger:   'CRITICAL CORE TEMPERATURE',
}

// Purely heat-driven so the message steps both ways: up as it's clicked, and
// back down through every stage to 'stable' as the core cools off. Thresholds
// line up with the shader's heatColor breakpoints (0.45 / 0.72).
const stageFor = (h: number): Stage =>
  h >= 0.72  ? 'danger'
  : h >= 0.45  ? 'unstable'
  : h >= 0.18  ? 'losing'
  :              'stable'

// JS port of the core fragment shader's blue → heatColor ramp.
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
// Hex (not rgb()) so the `${color}aa` alpha suffixes used for border/glow are valid.
const hex = (c: number[]) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
// `color` = the core's true colour (border + glow); `text` = the same hue lifted
// toward white so the low-luminance blue is still legible on the dark plaque.
function coreColors(h: number): { color: string; text: string } {
  const warm =
    h < 0.45 ? mix([1.0, 0.88, 0.25], [1.0, 0.45, 0.05], h / 0.45)
    : h < 0.72 ? mix([1.0, 0.45, 0.05], [1.0, 0.06, 0.0], (h - 0.45) / 0.27)
    : mix([1.0, 0.06, 0.0], [0.30, 0.0, 0.015], (h - 0.72) / 0.28)
  const c = mix([0.0, 0.30, 0.88], warm, smoothstep(0, 0.30, h))
  return { color: hex(c), text: hex(mix(c, [1, 1, 1], 0.5)) }
}

const StableIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-[18px] md:w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-[18px] md:w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9 16H3l9-16z" />
    <line x1="12" y1="9" x2="12" y2="14.5" />
    <circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

export default function CoreStatus() {
  const locked = isLocked(useEggPhase())
  const [visible, setVisible] = useState(false)
  const [st, setSt] = useState<{ stage: Stage; color: string; text: string }>({ stage: 'stable', ...coreColors(0) })
  const last = useRef('')

  // Only present while we're parked at the core (matches the sphere's fade-in).
  useEffect(() => onScroll((p) => setVisible(p > 0.8)), [])

  // Poll heat per-frame while on screen; commit to React only when it changes.
  useEffect(() => {
    if (!visible) return
    let raf = 0
    const tick = () => {
      const h = heat()
      const stage = stageFor(h)
      const { color, text } = coreColors(h)
      const key = stage + color
      if (key !== last.current) { last.current = key; setSt({ stage, color, text }) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  if (locked) return null
  const { stage, color, text } = st

  return (
    <div
      className="pointer-events-none relative z-40 mx-auto mt-8 w-max max-w-[88vw] self-center md:absolute md:bottom-10 md:left-1/2 md:top-auto md:mx-0 md:mt-0 md:-translate-x-1/2"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}
    >
      <div
        className={`flex items-center justify-center gap-2 rounded-none border px-2.5 py-1.5 text-center backdrop-blur-md md:gap-2.5 md:px-4 md:py-2.5 ${stage === 'danger' ? 'core-alarm' : ''}`}
        style={{
          color: text,
          borderColor: `${color}aa`,
          background: 'rgba(6,1,18,0.72)',
          boxShadow: `0 0 18px ${color}66, inset 0 0 12px ${color}22`,
        }}
      >
        <span className="shrink-0">{stage === 'stable' ? <StableIcon /> : <WarnIcon />}</span>
        <span
          className="font-mono text-[0.55rem] uppercase leading-tight tracking-[0.12em] md:text-sm md:tracking-[0.2em]"
          style={{ textShadow: `0 0 6px ${color}88` }}
        >
          {COPY[stage]}
        </span>
      </div>
    </div>
  )
}
