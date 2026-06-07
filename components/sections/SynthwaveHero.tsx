'use client'
import { useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import InfiniteHighway from '@/components/three/InfiniteHighway'
import HoverParticles from '@/components/three/HoverParticles'
import HeroSun from '@/components/three/HeroSun'

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
function CameraParallax() {
  const { camera } = useThree()
  const look = useMemo(() => new THREE.Vector3(0, 0, -30), [])

  useFrame((state) => {
    const { x, y } = state.pointer                       // normalized -1..1
    camera.position.x += (x * 2.0 - camera.position.x) * 0.04
    camera.position.y += (4 + y * 1.5 - camera.position.y) * 0.04
    look.set(-x * 4, 0.5 - y * 2, -30)
    camera.lookAt(look)
  })
  return null
}

export default function SynthwaveHero() {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* 3D background — audio is owned by AudioManager and shared via audioState */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 4, 14], fov: 55, near: 0.1, far: 200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          style={{ background: '#060112' }}
          dpr={[1, 2]}
        >
          <fog attach="fog" args={['#060112', 16, 52]} />
          <HeroSun />
          <InfiniteHighway glow="#ff007f" />
          <HoverParticles />
          <CameraParallax />

          <EffectComposer>
            <Bloom intensity={1.6} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
            <Vignette offset={0.35} darkness={0.8} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* HTML hero overlay */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-center px-10 md:px-24">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.3em]">
            <span style={neon('#ff007f')}>Full-Stack Developer</span>
          </p>

          <h1
            className="mb-9 flex flex-wrap items-center gap-4 text-6xl font-bold leading-[1.12] tracking-tight text-white md:text-8xl"
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.18)' }}
          >
            Artemii<span className="cursor-blink" style={glow('#00f3ff')}>_</span>

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
              <span className="hero-badge-text">available for hire</span>
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

          <div
            className="mt-12 flex items-center gap-3 text-sm text-slate-500"
            style={{ fontFamily: 'Space Mono, monospace' }}
          >
            <span>scroll to explore</span>
            <span className="block h-px w-12" style={{ background: '#00f3ff' }} />
            <span style={glow('#00f3ff')}>↓</span>
          </div>
        </div>
      </div>
    </section>
  )
}
