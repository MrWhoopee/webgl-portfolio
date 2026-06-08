'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useEggPhase } from '@/lib/egg'
import WarpQuotes from './WarpQuotes'

/* Host for the hidden scene. It sits above everything (z-[100]). The detonation
   is held on screen for a beat, then a white flash covers the swap into the warp
   canvas; on arrival a softer flash eases us out of warp into the Milky Way. */
const WarpScene = dynamic(() => import('./three/WarpScene'), { ssr: false })

export default function SecretLayer() {
  const phase = useEggPhase()
  const active = phase !== 'idle'
  const [flash, setFlash] = useState(0)
  const [dur, setDur] = useState(0.5)   // transition duration for the flash
  const [showBack, setShowBack] = useState(false)

  // The "back to reality" button surfaces a few seconds after we've arrived.
  useEffect(() => {
    if (phase !== 'galaxy') { setShowBack(false); return }
    const id = window.setTimeout(() => setShowBack(true), 6000)
    return () => clearTimeout(id)
  }, [phase])

  // Returns the site to its pristine state at the hero (a fresh page load —
  // every easter-egg lock lives in memory, so a reload wipes them all).
  const backToReality = () => {
    try { history.scrollRestoration = 'manual' } catch {}
    window.scrollTo(0, 0)
    window.location.reload()
  }

  useEffect(() => {
    if (phase === 'exploding') {
      // detonation flashes instantly to white, then the white screen is held
      // through the pause before the warp flight begins
      const id = requestAnimationFrame(() => { setDur(0.4); setFlash(1) })
      return () => cancelAnimationFrame(id)
    }
    if (phase === 'warp') {
      const id = requestAnimationFrame(() => { setDur(0.9); setFlash(0) })   // fade reveals the jump
      return () => cancelAnimationFrame(id)
    }
    if (phase === 'galaxy') {
      // drop-out punch: a fast bright flash, then a longer fade into the galaxy
      const id = requestAnimationFrame(() => { setDur(0.12); setFlash(1) })
      const id2 = window.setTimeout(() => { setDur(1.3); setFlash(0) }, 200)
      return () => { cancelAnimationFrame(id); clearTimeout(id2) }
    }
  }, [phase])

  // Belt-and-suspenders scroll lock (Lenis is also stopped in LenisProvider).
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  if (!active) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {(phase === 'warp' || phase === 'galaxy') && <WarpScene />}

      {/* Deep-space quotes while we fly */}
      {phase === 'warp' && <WarpQuotes />}

      {/* Flash — covers the detonation→warp swap and the warp→galaxy drop-out. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: '#eaf4ff',
          opacity: flash,
          transition: `opacity ${dur}s ease-in-out`,
        }}
      />

      {/* Arrival title */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-[38vh]"
        style={{
          opacity: phase === 'galaxy' ? 1 : 0,
          transition: 'opacity 2.5s ease-in 0.8s',
        }}
      >
        <h2
          className="text-5xl font-bold tracking-[0.18em] md:text-7xl"
          style={{ color: '#fff', textShadow: '0 0 30px #6f9bffcc, 0 0 60px #5a7bff66', lineHeight: 1.3, paddingBottom: '0.15em' }}
        >
          you made it
        </h2>
      </div>

      {/* Back to reality — top-right, fades in once we've settled in the galaxy */}
      {phase === 'galaxy' && (
        <button
          onClick={backToReality}
          className="absolute right-6 top-6 font-mono text-[0.7rem] uppercase tracking-[0.25em] transition-all hover:scale-105 md:right-10 md:top-8"
          style={{
            color: '#aef6ff',
            border: '1px solid #00f3ff66',
            background: 'rgba(2,6,18,0.5)',
            boxShadow: '0 0 18px #00f3ff33',
            padding: '0.6rem 1rem',
            backdropFilter: 'blur(6px)',
            opacity: showBack ? 1 : 0,
            pointerEvents: showBack ? 'auto' : 'none',
            transition: 'opacity 1.4s ease, transform 0.2s ease',
          }}
        >
          ← back to reality
        </button>
      )}
    </div>
  )
}
