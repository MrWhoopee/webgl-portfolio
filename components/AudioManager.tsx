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

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value))

  return (
    <>
      <audio ref={synthRef} src="/audio/synthwave-track.mp3" loop preload="auto" />
      <audio ref={cyberRef} src="/audio/cyber-city.mp3" loop preload="auto" />

      <div
        className="pointer-events-auto fixed bottom-8 right-8 z-50 flex items-center gap-4 rounded-none border px-4 py-2.5 backdrop-blur-md"
        style={{ borderColor: '#ff007f66', background: 'rgba(10,3,18,0.55)', boxShadow: '0 0 22px #ff007f33' }}
      >
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

        <div className="flex flex-col gap-1">
          <span
            className="text-[0.6rem] uppercase tracking-[0.2em]"
            style={{ fontFamily: 'Space Mono, monospace', color: track === 'cyber-city' ? '#00f3ff' : '#ff7fc3' }}
          >
            {track}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={onVolume}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer appearance-none rounded-none"
            style={{
              accentColor: '#ff007f',
              background: `linear-gradient(90deg, #ff007f ${volume * 100}%, #3a1a4d ${volume * 100}%)`,
            }}
          />
        </div>
      </div>
    </>
  )
}
