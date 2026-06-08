'use client'
import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { eggState, WARP_SECONDS, arrive } from '@/lib/egg'
import { LOW, DPR } from '@/lib/quality'

/* The hidden scene. We burst out of the exploding core into a warp jump that
   builds over ~59s: empty for the first 10s, then the odd star, then a thickening
   stream with mounting camera turbulence, until — BAM — we drop out into the
   Milky Way. Bright stars sweep past the flanks (never into the lens). Timing
   rides the starfall-warpath track (eggState.warpElapsed), wall-clock fallback. */

const DEPTH = 1600

function elapsed() {
  return eggState.warpElapsed > 0.05
    ? eggState.warpElapsed
    : (performance.now() - eggState.warpAt) / 1000
}
// 0..1 warp stretch: a long gradual spin-up over the first 10s, hold, then ease
// out over the last 1.2s (soft-ish drop-out).
function warpLevel(t: number) {
  if (t < 10) return THREE.MathUtils.smoothstep(t, 0, 10)
  if (t < WARP_SECONDS - 1.2) return 1
  if (t < WARP_SECONDS) return (WARP_SECONDS - t) / 1.2
  return 0
}
// 1 while travelling, eases to 0 over 1.2s after arrival (not a hard cut).
function arrivalFade(t: number) {
  return THREE.MathUtils.clamp(1 - (t - WARP_SECONDS) / 1.2, 0, 1)
}
// EXTRA bright stars only: none for the first 10s (just the accelerating base
// streaks), then a slow build to full.
function density(t: number) {
  return THREE.MathUtils.clamp((t - 10) / 40, 0, 1)
}
// camera turbulence: still until 25s, light build, violent at the very end.
function turbulence(t: number) {
  if (t < 25) return 0
  if (t < WARP_SECONDS - 5) return ((t - 25) / (WARP_SECONDS - 5 - 25)) * 0.45
  return 0.45 + Math.min(1, (t - (WARP_SECONDS - 5)) / 5) * 0.55
}

// Soft round glow sprite for the bright stars.
function starTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.55, 'rgba(160,200,255,0.35)')
  g.addColorStop(1, 'rgba(160,200,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Soft fading blob — reused (tinted) for nebula clouds and the galaxy core glow.
function softTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// How fully we've arrived (0 during warp → 1 settled in the galaxy). Drives the
// fade-in of every final-scene element.
function arrived(t: number) {
  return THREE.MathUtils.clamp((t - (WARP_SECONDS - 0.4)) / 1.4, 0, 1)
}

/* ─────────────────────────  WARP STAR STREAKS  ───────────────────────── */
function WarpStars() {
  const N = LOW ? 900 : 2200
  const geo = useRef<THREE.BufferGeometry>(null)
  const mat = useRef<THREE.LineBasicMaterial>(null)
  const { xs, ys, zs, col, posBuf } = useMemo(() => {
    const xs = new Float32Array(N), ys = new Float32Array(N), zs = new Float32Array(N)
    const col = new Float32Array(N * 2 * 3)
    const posBuf = new Float32Array(N * 2 * 3)
    const tint = [[0.8, 0.9, 1.0], [0.9, 0.85, 1.0], [1.0, 1.0, 0.95], [0.7, 0.95, 1.0]]
    for (let i = 0; i < N; i++) {
      xs[i] = (Math.random() - 0.5) * 1000
      ys[i] = (Math.random() - 0.5) * 1000
      zs[i] = -Math.random() * DEPTH
      const c = tint[(Math.random() * tint.length) | 0]
      for (let k = 0; k < 2; k++) {
        col[(i * 2 + k) * 3] = c[0]; col[(i * 2 + k) * 3 + 1] = c[1]; col[(i * 2 + k) * 3 + 2] = c[2]
      }
    }
    return { xs, ys, zs, col, posBuf }
  }, [N])

  useFrame((_, dt) => {
    const t = elapsed()
    const af = arrivalFade(t)
    if (af <= 0.001) { if (mat.current) mat.current.opacity = 0; return }   // arrived → skip the CPU loop
    const speed = (40 + warpLevel(t) * 1540) * af   // slow at first, then accelerates
    const len = 1.2 + warpLevel(t) * 90
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < N; i++) {
      zs[i] += speed * d
      if (zs[i] > 40) { zs[i] -= DEPTH; xs[i] = (Math.random() - 0.5) * 1000; ys[i] = (Math.random() - 0.5) * 1000 }
      const h = i * 2 * 3
      posBuf[h] = xs[i]; posBuf[h + 1] = ys[i]; posBuf[h + 2] = zs[i]
      posBuf[h + 3] = xs[i]; posBuf[h + 4] = ys[i]; posBuf[h + 5] = zs[i] - len
    }
    if (geo.current) (geo.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    if (mat.current) mat.current.opacity = arrivalFade(t)   // base streaks present from the start
  })

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[posBuf, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={mat} vertexColors transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  )
}

/* ─────────────────────────  BRIGHT STARS  ───────────────────────── */
function BrightStars() {
  const N = LOW ? 14 : 28
  const tex = useMemo(starTexture, [])
  const geo = useRef<THREE.BufferGeometry>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const { xs, ys, zs, col, posBuf } = useMemo(() => {
    const xs = new Float32Array(N), ys = new Float32Array(N), zs = new Float32Array(N)
    const col = new Float32Array(N * 3)
    const posBuf = new Float32Array(N * 3)
    const tint = [[1.0, 1.0, 1.0], [0.7, 0.85, 1.0], [1.0, 0.9, 0.7], [0.9, 0.95, 1.0]]
    const reseat = (i: number) => {
      const ang = Math.random() * Math.PI * 2
      const rad = 170 + Math.random() * 320       // off-axis so they sweep past the flanks
      xs[i] = Math.cos(ang) * rad
      ys[i] = Math.sin(ang) * rad * 0.7
    }
    for (let i = 0; i < N; i++) {
      reseat(i)
      zs[i] = -Math.random() * DEPTH
      const c = tint[(Math.random() * tint.length) | 0]
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]
    }
    return { xs, ys, zs, col, posBuf }
  }, [N])

  useFrame((_, dt) => {
    const t = elapsed()
    const f = arrivalFade(t)
    if (f <= 0.001) { if (mat.current) mat.current.opacity = 0; return }   // arrived → skip the CPU loop
    const dens = density(t)
    const speed = (110 + warpLevel(t) * 1300) * f
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < N; i++) {
      // gradually more stars come into play as density rises
      if (i / N < dens) {
        zs[i] += speed * d
        if (zs[i] > 50) {                          // recycle before the camera plane — never into the lens
          zs[i] -= DEPTH
          const ang = Math.random() * Math.PI * 2
          const rad = 170 + Math.random() * 320
          xs[i] = Math.cos(ang) * rad
          ys[i] = Math.sin(ang) * rad * 0.7
        }
        posBuf[i * 3] = xs[i]; posBuf[i * 3 + 1] = ys[i]; posBuf[i * 3 + 2] = zs[i]
      } else {
        posBuf[i * 3] = 0; posBuf[i * 3 + 1] = 0; posBuf[i * 3 + 2] = 6000   // parked behind the camera
      }
    }
    if (geo.current) (geo.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    if (mat.current) mat.current.opacity = f
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[posBuf, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        map={tex}
        size={95}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/* ─────────────────────────  MILKY WAY  ───────────────────────── */
function Galaxy() {
  const N = LOW ? 6000 : 16000
  const grp = useRef<THREE.Group>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const glow = useRef<THREE.Sprite>(null)
  const glowTex = useMemo(softTexture, [])
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(N * 3)
    const colors = new Float32Array(N * 3)
    const ARMS = 4
    const core = new THREE.Color('#fff3c8')
    const edge = new THREE.Color('#5a7bff')
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.6) * 300
      const arm = (i % ARMS) / ARMS * Math.PI * 2
      const spin = r * 0.018
      const scatter = (Math.random() - 0.5) * (0.5 + (1 - r / 300) * 1.2)
      const a = arm + spin + scatter
      positions[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 18
      positions[i * 3 + 1] = (Math.random() - 0.5) * (8 + (1 - r / 300) * 40)
      positions[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 18
      const c = core.clone().lerp(edge, Math.min(1, r / 300))
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    return { positions, colors }
  }, [N])

  useFrame((_, dt) => {
    const a = arrived(elapsed())
    if (grp.current) { grp.current.visible = a > 0.001; grp.current.rotation.y += dt * 0.03 }   // off during the warp
    if (a <= 0.001) return
    if (mat.current) mat.current.opacity = a
    if (glow.current) (glow.current.material as THREE.SpriteMaterial).opacity = a * 0.9
  })

  return (
    <group ref={grp} position={[0, -30, -360]} rotation={[1.05, 0, 0.2]}>
      {/* bright core glow */}
      <sprite ref={glow} scale={[260, 260, 1]}>
        <spriteMaterial map={glowTex} color="#ffe9b0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={mat}
          size={2.8}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

/* ─────────────────────────  COSMIC BACKDROP  ─────────────────────────
   Final-scene only: a still field of distant stars behind the galaxy plus a few
   soft nebula clouds. All static (no per-frame CPU work) and rendered only once
   we've arrived, so it costs nothing during the warp. */
function Cosmos() {
  const root = useRef<THREE.Group>(null)
  const starsMat = useRef<THREE.PointsMaterial>(null)
  const nebulaRefs = useRef<(THREE.Sprite | null)[]>([])
  const tex = useMemo(softTexture, [])

  const NS = LOW ? 1400 : 3600
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(NS * 3)
    const colors = new Float32Array(NS * 3)
    const tint = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.92, 0.8]]
    for (let i = 0; i < NS; i++) {
      // far shell — only the −z hemisphere reads on screen, i.e. behind the galaxy
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = 1900 + Math.random() * 1300
      const s = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(th) * s * r
      positions[i * 3 + 1] = u * r * 0.7
      positions[i * 3 + 2] = -Math.abs(Math.sin(th) * s * r) - 400   // pushed behind the galaxy
      const c = tint[(Math.random() * tint.length) | 0]
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2]
    }
    return { positions, colors }
  }, [NS])

  const nebulae = useMemo(() =>
    Array.from({ length: LOW ? 3 : 6 }).map((_, i) => ({
      pos: [(Math.random() - 0.5) * 1400, (Math.random() - 0.5) * 700, -700 - i * 220 - Math.random() * 300] as [number, number, number],
      scale: 700 + Math.random() * 800,
      color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.6, 0.5),
    })), [])

  useFrame(() => {
    const a = arrived(elapsed())
    if (root.current) root.current.visible = a > 0.001   // not drawn at all during the warp
    if (a <= 0.001) return
    if (starsMat.current) starsMat.current.opacity = a
    nebulaRefs.current.forEach((s) => { if (s) (s.material as THREE.SpriteMaterial).opacity = a * 0.22 })
  })

  return (
    <group ref={root} visible={false}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={starsMat} size={2} sizeAttenuation={false} vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {nebulae.map((n, i) => (
        <sprite key={i} ref={(el) => { nebulaRefs.current[i] = el }} position={n.pos} scale={[n.scale, n.scale, 1]}>
          <spriteMaterial map={tex} color={n.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

/* Mouse banking + flight turbulence. */
function CameraRig() {
  const { camera, pointer } = useThree()
  const base = useRef({ x: 0, y: 0 })
  useFrame(() => {
    const t = elapsed()
    base.current.x += (pointer.x * 22 - base.current.x) * 0.03
    base.current.y += (pointer.y * 14 - base.current.y) * 0.03
    const tb = turbulence(t) * arrivalFade(t)   // shake dies as we drop out of warp
    const jx = (Math.sin(t * 31.0) + Math.sin(t * 17.3) * 0.7) * tb * 6
    const jy = (Math.sin(t * 27.0) + Math.sin(t * 23.1) * 0.7) * tb * 6
    const jr = Math.sin(t * 19.0) * tb * 0.05
    camera.position.set(base.current.x + jx, base.current.y + jy, 0)
    camera.rotation.z = -pointer.x * 0.14 + jr
    camera.rotation.x = pointer.y * 0.07 + jy * 0.004
    camera.rotation.y = -pointer.x * 0.07
  })
  return null
}

/* Drops us out of warp on arrival (flips to the final 'galaxy' phase). */
function ArrivalGate() {
  useFrame(() => {
    if (eggState.phase === 'warp' && elapsed() >= WARP_SECONDS) arrive()
  })
  return null
}

export default function WarpScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 0], fov: 80, near: 0.1, far: 4000 }}
      gl={{ antialias: !LOW, powerPreference: 'high-performance' }}
      dpr={DPR}
      style={{ background: '#01010a' }}
    >
      <WarpStars />
      <BrightStars />
      <Galaxy />
      <Cosmos />
      <CameraRig />
      <ArrivalGate />
      {LOW ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.5} luminanceThreshold={0.02} luminanceSmoothing={0.9} mipmapBlur />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={4}>
          <Bloom intensity={1.9} luminanceThreshold={0.02} luminanceSmoothing={0.9} mipmapBlur />
          <Vignette offset={0.3} darkness={0.85} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
