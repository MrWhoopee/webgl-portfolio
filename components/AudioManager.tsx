'use client'
import { useEffect, useRef, useState } from 'react'
import { scrollState } from '@/lib/scroll'
import { audioState } from '@/lib/audio'

/* Owns both soundtracks and one shared analyser. Synthwave plays over the hero
   and pink planes; as the camera dives into the city the mix crossfades to
   `cyber-city`. The analyser sums both, so whichever track is audible drives
   every reactive scene. */
// The cyber track rises as the camera nears the lower plane and is fully in by
// the time we punch through it (≈0.53), so the city greets us already playing.
const FADE_START = 0.42
const FADE_END   = 0.52
const SEG = 14   // volume column resolution (segments that cascade in on open)

export default function AudioManager() {
  const synthRef = useRef<HTMLAudioElement>(null)
  const cyberRef = useRef<HTMLAudioElement>(null)
  const ctxRef   = useRef<AudioContext | null>(null)
  const synthGain = useRef<GainNode | null>(null)
  const cyberGain = useRef<GainNode | null>(null)
  const masterGain = useRef<GainNode | null>(null)
  const built = useRef(false)
  const playingRef = useRef(false)
  const trackRef = useRef<'synthwave' | 'cyber-city'>('synthwave')

  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.25)
  const [track, setTrack] = useState<'synthwave' | 'cyber-city'>('synthwave')
  const [volOpen, setVolOpen] = useState(false)

  const groupRef = useRef<HTMLDivElement>(null)
  const colRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const build = () => {
    if (built.current) return
    const s = synthRef.current, c = cyberRef.current
    if (!s || !c) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const an = ctx.createAnalyser()
    an.fftSize = 128
    an.smoothingTimeConstant = 0.6
    an.minDecibels = -85
    an.maxDecibels = -25
    const sg = ctx.createGain(), cg = ctx.createGain(), mg = ctx.createGain()
    sg.gain.value = 1; cg.gain.value = 0; mg.gain.value = volume
    ctx.createMediaElementSource(s).connect(sg).connect(an)
    ctx.createMediaElementSource(c).connect(cg).connect(an)
    an.connect(mg).connect(ctx.destination)
    ctxRef.current = ctx
    synthGain.current = sg; cyberGain.current = cg; masterGain.current = mg
    audioState.analyser = an
    built.current = true
  }

  const setPlay = (v: boolean) => { playingRef.current = v; audioState.playing = v; setPlaying(v) }

  // Autoplay; if blocked, resume on the first pointer gesture.
  useEffect(() => {
    const start = async () => {
      build()
      await ctxRef.current?.resume()
      await synthRef.current?.play()
      setPlay(true)
    }
    start().catch(() => {
      const onFirst = () => { start().catch(() => {}); document.removeEventListener('pointerdown', onFirst) }
      document.addEventListener('pointerdown', onFirst, { once: true })
    })
  }, [])

  // Crossfade by scroll; lazily start/stop the cyber track to save decoding.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const p = scrollState.progress
      const k = Math.min(1, Math.max(0, (p - FADE_START) / (FADE_END - FADE_START)))
      if (synthGain.current) synthGain.current.gain.value = 1 - k
      if (cyberGain.current) cyberGain.current.gain.value = k

      const c = cyberRef.current
      if (c && playingRef.current) {
        if (k > 0.01 && c.paused) { ctxRef.current?.resume(); c.play().catch(() => {}) }
        else if (k <= 0.01 && !c.paused) c.pause()
      }

      const nt = k > 0.5 ? 'cyber-city' : 'synthwave'
      if (nt !== trackRef.current) { trackRef.current = nt; setTrack(nt) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => { if (masterGain.current) masterGain.current.gain.value = volume }, [volume])

  // Ramp the master gain so the sound eases in/out instead of cutting hard.
  const fadeMaster = (to: number, dur: number) => {
    const g = masterGain.current, ctx = ctxRef.current
    if (!g || !ctx) return
    const now = ctx.currentTime
    g.gain.cancelScheduledValues(now)
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now)
    g.gain.linearRampToValueAtTime(to, now + dur)
  }

  const toggle = () => {
    if (playingRef.current) {
      setPlay(false)             // visuals begin their gentle fade-out at once
      fadeMaster(0, 0.6)
      window.setTimeout(() => {  // pause only once it's silent
        if (playingRef.current) return
        synthRef.current?.pause()
        cyberRef.current?.pause()
      }, 600)
    } else {
      build()
      ctxRef.current?.resume()
      synthRef.current?.play().catch(() => {})
      fadeMaster(volume, 0.6)
      setPlay(true)   // crossfade loop resumes the cyber track if we're in its zone
    }
  }

  // Volume from the vertical column: top = 1, bottom = 0.
  const setFromPointer = (clientY: number) => {
    const el = colRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setVolume(Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height)))
  }

  // Close the popup when a pointer lands outside the volume group.
  useEffect(() => {
    if (!volOpen) return
    const onDown = (e: PointerEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setVolOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [volOpen])

  return (
    <>
      <audio ref={synthRef} src="/audio/synthwave-track.mp3" loop preload="auto" />
      <audio ref={cyberRef} src="/audio/cyber-city.mp3" loop preload="auto" />

      <div
        className="pointer-events-auto fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2 rounded-none border p-2.5 backdrop-blur-md md:px-4 md:py-2.5"
        style={{ borderColor: '#ff007f66', background: 'rgba(10,3,18,0.55)', boxShadow: '0 0 22px #ff007f33' }}
      >
        <div className="flex items-center gap-0.5">
        <button
          onClick={toggle}
          aria-label={playing ? 'Pause music' : 'Play music'}
          className="flex h-9 w-9 items-center justify-center rounded-none transition-transform hover:scale-110"
          style={{ background: 'rgba(255,0,127,0.12)', boxShadow: '0 0 12px #ff007f55' }}
        >
          {playing ? (
            <span className="flex gap-[3px]">
              <span className="block h-3.5 w-[3px] rounded-sm" style={{ background: '#ff007f' }} />
              <span className="block h-3.5 w-[3px] rounded-sm" style={{ background: '#ff007f' }} />
            </span>
          ) : (
            <span
              className="ml-[3px] block h-0 w-0"
              style={{
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: '10px solid #ff007f',
              }}
            />
          )}
        </button>

        {/* Volume — a twin button right of play; the column pops up above it,
            its segments cascading in like a terminal load. */}
        <div ref={groupRef} className="relative">
          <button
            onClick={() => setVolOpen((v) => !v)}
            aria-label="Volume"
            aria-expanded={volOpen}
            className="flex h-9 w-9 items-center justify-center rounded-none transition-transform hover:scale-110"
            style={{ background: 'rgba(255,0,127,0.12)', boxShadow: '0 0 12px #ff007f55' }}
          >
            <span className="flex items-end gap-[2px]">
              <span className="block w-[3px] rounded-sm" style={{ height: 6,  background: '#ff007f' }} />
              <span className="block w-[3px] rounded-sm" style={{ height: 10, background: '#ff007f' }} />
              <span className="block w-[3px] rounded-sm" style={{ height: 14, background: '#ff007f' }} />
            </span>
          </button>

          {volOpen && (
            <div
              className="vol-pop absolute bottom-full left-1/2 mb-3 flex w-9 -translate-x-1/2 flex-col items-center gap-1.5 rounded-none border py-2.5 backdrop-blur-md"
              style={{ borderColor: '#ff007f66', background: 'rgba(10,3,18,0.85)', boxShadow: '0 0 22px #ff007f44' }}
            >
              <span
                className="font-mono text-[0.5rem] tabular-nums tracking-[0.05em]"
                style={{ color: '#ff7fc3' }}
              >
                {Math.round(volume * 100).toString().padStart(2, '0')}%
              </span>

              <div
                ref={colRef}
                onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e.clientY) }}
                onPointerMove={(e) => { if (draggingRef.current) setFromPointer(e.clientY) }}
                onPointerUp={() => { draggingRef.current = false }}
                onPointerCancel={() => { draggingRef.current = false }}
                className="flex w-full cursor-pointer flex-col-reverse gap-[3px] px-1.5 py-1"
                style={{ touchAction: 'none' }}
              >
                {Array.from({ length: SEG }).map((_, i) => {
                  const lit = i < Math.round(volume * SEG)
                  return (
                    <span
                      key={i}
                      className="vol-seg block h-[5px] w-full rounded-sm"
                      style={{
                        background: lit ? '#ff007f' : 'rgba(255,0,127,0.15)',
                        boxShadow: lit ? '0 0 8px #ff007fcc' : 'none',
                        animationDelay: `${i * 35}ms`,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Track name under the buttons */}
        <span
          className="font-mono text-[0.55rem] uppercase tracking-[0.25em]"
          style={{ color: track === 'cyber-city' ? '#00f3ff' : '#ff7fc3' }}
        >
          {track}
        </span>
      </div>
    </>
  )
}
