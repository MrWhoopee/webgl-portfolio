'use client'
import { useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import InfiniteHighway from '@/components/three/InfiniteHighway'
import HoverParticles from '@/components/three/HoverParticles'
import HeroSun from '@/components/three/HeroSun'
import { onScroll } from '@/lib/scroll'
import { useInteractionPaused } from '@/lib/interaction'
import { LOW } from '@/lib/quality'
import { useBudgetDpr } from '@/lib/useBudgetDpr'
import { useIsPhone } from '@/lib/useIsPhone'

const glow = (c: string) => ({ color: c, textShadow: `0 0 8px ${c}cc, 0 0 22px ${c}66` })

// Neon text over the bright terrain: same glow + a dark backing for legibility.
const neon = (c: string): React.CSSProperties => ({
  ...glow(c),
  background: 'rgba(6,1,18,0.55)',
  padding: '0.05em 0.3em',
  borderRadius: '0',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
})

/* Camera parallax — mouse left tilts the view right, for premium 3D depth. */
function CameraParallax({ phone }: { phone: boolean }) {
  const { camera } = useThree()
  const look = useMemo(() => new THREE.Vector3(0, 0, -30), [])

  useFrame((state) => {
    // Phones have no cursor, so freeze the pointer-driven parallax (keeps the
    // framing, drops the pointless hover sway); tablets/desktop keep it.
    const x = phone ? 0 : state.pointer.x                 // normalized -1..1
    const y = phone ? 0 : state.pointer.y
    camera.position.x += (x * 2.0 - camera.position.x) * 0.04
    camera.position.y += (4 + y * 1.5 - camera.position.y) * 0.04
    look.set(-x * 4, 0.5 - y * 2, -30)
    camera.lookAt(look)
  })
  return null
}

export default function SynthwaveHero() {
  const isPhone = useIsPhone()
  // Freeze the hero's WebGL loop once it scrolls out of view — no point running a
  // second bloom pipeline + highway + particles behind the city / core scenes.
  const [active, setActive] = useState(true)
  useEffect(() => onScroll((p) => setActive(p < 0.28)), [])
  // Also freeze while resizing/zooming — see lib/interaction.
  const paused = useInteractionPaused()
  const dpr = useBudgetDpr()

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* 3D background — audio is owned by AudioManager and shared via audioState */}
      <div className="absolute inset-0">
        <Canvas
          frameloop={active && !paused ? 'always' : 'never'}
          camera={{ position: [0, 4, 14], fov: 55, near: 0.1, far: 200 }}
          gl={{ antialias: !LOW, powerPreference: 'high-performance' }}
          style={{ background: '#060112' }}
          dpr={dpr}
        >
          <fog attach="fog" args={['#060112', 16, 52]} />
          <HeroSun />
          <InfiniteHighway glow="#ff007f" phone={isPhone} />
          <HoverParticles phone={isPhone} />
          <CameraParallax phone={isPhone} />

          <EffectComposer>
            <Bloom intensity={1.6} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
            <Vignette offset={0.35} darkness={0.8} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* HTML hero overlay */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-center px-10 md:px-24" style={{ paddingLeft: '3px' }}>
        <div className="max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.3em]">
            <span style={neon('#ff007f')}>Full-Stack Developer</span>
          </p>

          <h1
            className="mb-9 flex flex-wrap items-center gap-4 text-6xl font-bold leading-[1.12] tracking-tight text-white md:text-8xl"
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.18)' }}
          >
            {/* Name owns a full row on phones so the badge always drops to the
                next line directly beneath it (one gap-4), inline on desktop. */}
            <span className="basis-full md:basis-auto">
              Artemii<span className="cursor-blink" style={glow('#00f3ff')}>_</span>
            </span>

            {/* Terminal typewriter badge */}
            <span
              className="hero-badge inline-flex items-center rounded-none border px-3 py-1 font-mono text-xs lowercase"
              style={{
                background: 'rgba(0,243,255,0.06)',
                borderColor: '#00f3ff77',
                boxShadow: '0 0 12px #00f3ff33',
                color: '#a5f3ff',
              }}
            >
              <span className="hero-badge-text">available for hiring</span>
              <span className="cursor-blink font-mono" style={{ color: '#ff007f' }}>_</span>
            </span>
          </h1>

          <p
            className="max-w-xl text-xl font-light leading-relaxed text-slate-300 md:text-2xl"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            Building modern web experiences with{' '}
            <span style={neon('#ff007f')}>Next.js</span>,{' '}
            <span style={neon('#00f3ff')}>WebGL</span> and{' '}
            <span style={neon('#ff007f')}>React Three Fiber</span>.
          </p>

        </div>
      </div>

      {/* Scroll hint — centered along the bottom of the hero, neon-lit */}
      <div
        className="pointer-events-none absolute bottom-32 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap text-base md:bottom-10"
        style={{ fontFamily: 'Space Mono, monospace', ...glow('#00f3ff') }}
      >
        <span>scroll to explore</span>
        <span className="block h-px w-16" style={{ background: '#00f3ff', boxShadow: '0 0 8px #00f3ffcc' }} />
        <span>↓</span>
      </div>
    </section>
  )
}
