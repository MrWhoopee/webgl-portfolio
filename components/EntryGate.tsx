'use client'
import { useState } from 'react'
import { audioState } from '@/lib/audio'

/* Browsers forbid audio before a user gesture, so the site opens behind this
   gate. The ENTER click IS that gesture: it calls audioState.start() directly
   (synchronously, Safari-safe) to fire the soundtrack, then fades itself out. */
export default function EntryGate() {
  const [entered, setEntered] = useState(false)
  const [gone, setGone] = useState(false)

  if (gone) return null

  return (
    <div
      onClick={() => {
        audioState.start?.()
        setEntered(true)
        window.setTimeout(() => setGone(true), 700) // outlast the fade
      }}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 transition-opacity duration-700"
      style={{
        background: 'radial-gradient(circle at 50% 45%, #1a0420 0%, #05010a 70%)',
        opacity: entered ? 0 : 1,
        pointerEvents: entered ? 'none' : 'auto',
      }}
    >
      <span
        className="font-mono text-[0.6rem] uppercase tracking-[0.4em]"
        style={{ color: '#00f3ff', textShadow: '0 0 12px #00f3ff88' }}
      >
        sound on
      </span>
      <span
        className="entry-pulse font-mono text-5xl font-bold uppercase tracking-[0.3em] md:text-7xl"
        style={{ color: '#ff007f', textShadow: '0 0 28px #ff007f, 0 0 60px #ff007f66' }}
      >
        Enter
      </span>
      <span
        className="font-mono text-[0.55rem] uppercase tracking-[0.25em]"
        style={{ color: '#ff7fc3' }}
      >
        click anywhere to begin
      </span>
    </div>
  )
}
