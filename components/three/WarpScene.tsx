'use client'
import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { eggState, WARP_SECONDS, arrive } from '@/lib/egg'
import { LOW } from '@/lib/quality'
import { useBudgetDpr } from '@/lib/useBudgetDpr'
import { useInteractionPaused } from '@/lib/interaction'

/* The hidden scene. We burst out of the exploding core into a warp jump that
   builds over ~59s: empty for the first 10s, then the odd star, then a thickening
   stream with mounting camera turbulence, until — BAM — we drop out into the
   Milky Way. Bright stars sweep past the flanks (never into the lens). Timing
   rides the starfall-warpath track (eggState.warpElapsed), wall-clock fallback. */

const DEPTH = 1600
// The quotes finish fading out ~here; keep the flight calm & readable until then,
// then slam the throttle for the final dash into the galaxy.
const CRUISE_END = 51
const CRUISE = 0.6

function elapsed() {
  return eggState.warpElapsed > 0.05
    ? eggState.warpElapsed
    : (performance.now() - eggState.warpAt) / 1000
}
// warp stretch: spin up to a steady, readable cruise, hold it while the quotes
// run, then accelerate HARD past full speed for the climax — no slow-down, we
// just burst straight out into the galaxy.
function warpLevel(t: number) {
  if (t < 10) return THREE.MathUtils.smoothstep(t, 0, 10) * CRUISE
  if (t < CRUISE_END) return CRUISE
  const k = THREE.MathUtils.clamp((t - CRUISE_END) / (WARP_SECONDS - CRUISE_END), 0, 1)
  return CRUISE + k * k * (3.2 - CRUISE)
}
// 1 while travelling, eases to 0 over 1.2s after arrival (not a hard cut).
function arrivalFade(t: number) {
  return THREE.MathUtils.clamp(1 - (t - WARP_SECONDS) / 0.7, 0, 1)
}
// EXTRA bright stars only: none for the first 10s (just the accelerating base
// streaks), then a slow build to full.
function density(t: number) {
  return THREE.MathUtils.clamp((t - 10) / 40, 0, 1)
}
// camera turbulence: dead calm while the quotes run (readable), then ramps to a
// violent shake over the final dash.
function turbulence(t: number) {
  if (t < CRUISE_END) return 0
  return THREE.MathUtils.clamp((t - CRUISE_END) / (WARP_SECONDS - CRUISE_END), 0, 1)
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
  const N = LOW ? 7 : 14
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
  const halo = useRef<THREE.Sprite>(null)
  const beamRefs = useRef<(THREE.Mesh | null)[]>([])
  const glowTex = useMemo(softTexture, [])
  const { positions, colors } = useMemo(() => {
    const TAIL = LOW ? 1500 : 4000
    const HAZE = LOW ? 3000 : 8000              // diffuse fill so the disk isn't sparse
    const positions = new Float32Array((N + TAIL + HAZE) * 3)
    const colors = new Float32Array((N + TAIL + HAZE) * 3)
    const ARMS = 2
    // radial palette from the ref: white-gold core → pink/red bulge → violet → blue arms
    const RAMP: [number, THREE.Color][] = [
      [0.00, new THREE.Color('#fff6dc')],
      [0.10, new THREE.Color('#ffd6a6')],
      [0.24, new THREE.Color('#ff8aa6')],
      [0.40, new THREE.Color('#e6588f')],
      [0.58, new THREE.Color('#9663ff')],
      [0.80, new THREE.Color('#5d78ff')],
      [1.00, new THREE.Color('#46a6ff')],
    ]
    const tmp = new THREE.Color()
    const ramp = (t: number) => {
      for (let k = 1; k < RAMP.length; k++) {
        if (t <= RAMP[k][0]) {
          const a0 = RAMP[k - 1], b0 = RAMP[k]
          return tmp.copy(a0[1]).lerp(b0[1], (t - a0[0]) / (b0[0] - a0[0]))
        }
      }
      return tmp.copy(RAMP[RAMP.length - 1][1])
    }
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.6) * 300
      const rr = r / 300
      const arm = (i % ARMS) / ARMS * Math.PI * 2
      const spin = r * 0.020
      const scatter = (Math.random() - 0.5) * (0.55 + (1 - rr) * 1.3)   // wider spread fills the gaps
      const a = arm + spin + scatter
      positions[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 18
      positions[i * 3 + 1] = (Math.random() - 0.5) * (6 + (1 - rr) * 34)
      positions[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 18
      // bright on the arm centreline, dim between arms → defined sweeping spiral
      const onArm = 1 - THREE.MathUtils.clamp(Math.abs(scatter) / 0.9, 0, 1)
      const c = ramp(rr).clone().multiplyScalar(0.42 + onArm * 0.58)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    // long trailing streamers feathering off the arm tips → the galaxy's "tails"
    const tail = new THREE.Color()
    for (let j = 0; j < TAIL; j++) {
      const tr = 250 + Math.pow(Math.random(), 0.5) * 200          // 250..450, well past the disk
      const arm = (j % ARMS) / ARMS * Math.PI * 2
      const a = arm + tr * 0.020 + 0.5 + (Math.random() - 0.5) * 0.3   // extra winding, thin spread
      const o = (N + j) * 3
      positions[o] = Math.cos(a) * tr + (Math.random() - 0.5) * 26
      positions[o + 1] = (Math.random() - 0.5) * 10
      positions[o + 2] = Math.sin(a) * tr + (Math.random() - 0.5) * 26
      tail.copy(RAMP[5][1]).lerp(RAMP[6][1], Math.random()).multiplyScalar(0.4)
      colors[o] = tail.r; colors[o + 1] = tail.g; colors[o + 2] = tail.b
    }
    // dim haze on random angles (no arm bias) → softly floods the inter-arm space
    for (let h = 0; h < HAZE; h++) {
      const r = Math.pow(Math.random(), 0.7) * 320
      const rr = r / 300
      const a = Math.random() * Math.PI * 2 + r * 0.012
      const o = (N + TAIL + h) * 3
      positions[o] = Math.cos(a) * r + (Math.random() - 0.5) * 22
      positions[o + 1] = (Math.random() - 0.5) * (8 + (1 - Math.min(1, rr)) * 40)
      positions[o + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 22
      const c = ramp(Math.min(1, rr)).clone().multiplyScalar(0.22)
      colors[o] = c.r; colors[o + 1] = c.g; colors[o + 2] = c.b
    }
    return { positions, colors }
  }, [N])

  useFrame((_, dt) => {
    const a = arrived(elapsed())
    if (grp.current) { grp.current.visible = a > 0.001; grp.current.rotation.y += dt * 0.03 }   // off during the warp
    if (a <= 0.001) return
    if (mat.current) mat.current.opacity = a
    if (glow.current) (glow.current.material as THREE.SpriteMaterial).opacity = a * 0.9
    if (halo.current) (halo.current.material as THREE.SpriteMaterial).opacity = a * 0.5
    const beam = a * (0.55 + Math.sin(elapsed() * 1.6) * 0.12)   // gentle pulse
    beamRefs.current.forEach((m) => { if (m) (m.material as THREE.MeshBasicMaterial).opacity = beam })
  })

  return (
    <group ref={grp} position={[0, -20, -360]} rotation={[0.62, 0, 0.22]}>
      {/* reddish bulge haze, then the bright gold core */}
      <sprite ref={halo} scale={[440, 300, 1]}>
        <spriteMaterial map={glowTex} color="#ff6f93" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={glow} scale={[210, 210, 1]}>
        <spriteMaterial map={glowTex} color="#fff0cf" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* light shaft bursting out of the core, perpendicular to the disk (two crossed planes) */}
      {[0, Math.PI / 2].map((ry, i) => (
        <mesh key={i} ref={(el) => { beamRefs.current[i] = el }} rotation={[0, ry, 0]} scale={[44, 700, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={glowTex} color="#cdeaff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={mat}
          map={glowTex}
          size={5}
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

/* ─────────────────────────  VIOLET NEBULA  ─────────────────────────
   Ridged domain-warped noise → filamentary cosmic wisps. BAKED ONCE into an
   equirect texture at mount, then mapped on a sphere: the costly noise runs a
   single time, so per-frame it's just one textured draw — no fragment cost on
   large/4K screens. */
const NEBULA_BAKE_FRAG = /* glsl */`
  uniform vec3 cBlue, cPink;
  varying vec2 vUv;
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
  float ridged(vec3 p){
    float v=0.0, a=0.5;
    for(int i=0;i<6;i++){ float n=noise(p); n=1.0-abs(2.0*n-1.0); n*=n; v+=a*n; p*=2.03; a*=0.5; }
    return v;
  }
  void main(){
    // equirect uv → direction on the unit sphere (matches SphereGeometry uvs)
    float lon = (vUv.x * 2.0 - 1.0) * 3.14159265;
    float lat = (vUv.y - 0.5) * 3.14159265;
    vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    vec3 p = d * 3.0;
    vec3 w = vec3(fbm(p), fbm(p + vec3(5.2, 1.3, 0.0)), fbm(p + vec3(-2.1, 0.0, 3.7)));
    float f = ridged(p * 1.35 + w * 1.9);
    f = pow(f, 2.2);
    f *= smoothstep(0.30, 0.80, fbm(p * 0.55 + 11.0));     // big-scale voids between wisps
    float pink = smoothstep(0.55, 0.95, fbm(p * 0.5 + 21.0));
    vec3 col = mix(cBlue, cPink, pink);
    col *= 0.5 + 0.9 * f;
    gl_FragColor = vec4(col, clamp(f * 1.7, 0.0, 1.0));
  }
`
const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`
function NebulaField() {
  const { gl } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  // bake the noise into an equirect texture exactly once
  const tex = useMemo(() => {
    const size = LOW ? 1024 : 2048
    const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false })
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: NEBULA_BAKE_FRAG,
        uniforms: {
          cBlue: { value: new THREE.Color('#2f5cff') },
          cPink: { value: new THREE.Color('#c25cd0') },
        },
      }),
    )
    scene.add(quad)
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(rt)
    gl.render(scene, cam)
    gl.setRenderTarget(prev)
    quad.geometry.dispose()
    ;(quad.material as THREE.Material).dispose()
    return rt.texture
  }, [gl])

  useFrame(() => {
    const a = arrived(elapsed())
    if (mesh.current) mesh.current.visible = a > 0.001
    if (matRef.current) matRef.current.opacity = a
  })

  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false} visible={false}>
      <sphereGeometry args={[3200, 32, 24]} />
      <meshBasicMaterial ref={matRef} map={tex} side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/* ─────────────────────────  FAR GALAXIES  ─────────────────────────
   A few faint, low-detail spirals drifting deep in the background. */
function miniSpiral(n: number, maxR: number, c0: string, c1: string) {
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const core = new THREE.Color(c0), edge = new THREE.Color(c1), t = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 0.6) * maxR
    const arm = (i % 2) / 2 * Math.PI * 2
    const a = arm + r * 0.024 + (Math.random() - 0.5) * (0.4 + (1 - r / maxR) * 1.0)
    positions[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 6
    positions[i * 3 + 1] = (Math.random() - 0.5) * (2 + (1 - r / maxR) * 8)
    positions[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 6
    t.copy(core).lerp(edge, r / maxR).multiplyScalar(0.4 + Math.random() * 0.4)
    colors[i * 3] = t.r; colors[i * 3 + 1] = t.g; colors[i * 3 + 2] = t.b
  }
  return { positions, colors }
}

function FarGalaxies() {
  const root = useRef<THREE.Group>(null)
  const matRefs = useRef<(THREE.PointsMaterial | null)[]>([])
  const glowRefs = useRef<(THREE.Sprite | null)[]>([])
  const tex = useMemo(softTexture, [])
  const n = LOW ? 120 : 320                     // very few points each — 30 galaxies stays cheap, glow-led
  const defs = useMemo(() => {
    const pal = [
      ['#fff0d8', '#7aa0ff', '#ffcdb0'], ['#ffe6f0', '#9a7bff', '#ffc0d8'],
      ['#fff4ea', '#5fa0ff', '#bfe0ff'], ['#fff2e0', '#8a8bff', '#ffd6e6'],
    ]
    const COUNT = LOW ? 18 : 30
    const out: { pos: [number, number, number]; rot: [number, number, number]; maxR: number; glow: string; c0: string; c1: string }[] = []
    const seen: [number, number][] = []      // angular (screen) positions already taken
    let guard = 0
    while (out.length < COUNT && guard++ < COUNT * 60) {
      const d = -1200 - Math.random() * 2600
      const ad = Math.abs(d)
      const ax = (Math.random() - 0.5) * 1.8   // angular x/y (∝ on-screen position, depth-independent)
      const ay = (Math.random() - 0.5) * 1.1
      if (Math.abs(ax) < 0.28 && Math.abs(ay) < 0.22) continue          // keep clear of the main galaxy
      if (seen.some(([sx, sy]) => Math.hypot(ax - sx, ay - sy) < 0.26)) continue   // hold them apart
      seen.push([ax, ay])
      const p = pal[(Math.random() * pal.length) | 0]
      out.push({
        pos: [ax * ad, ay * ad, d],
        rot: [Math.random() * 1.2, Math.random() * Math.PI, (Math.random() - 0.5) * 1.4],
        maxR: 110 + Math.random() * 150,
        glow: p[2], c0: p[0], c1: p[1],
      })
    }
    return out
  }, [])
  const geos = useMemo(() => defs.map((d) => miniSpiral(n, d.maxR, d.c0, d.c1)), [defs, n])

  useFrame(() => {
    const a = arrived(elapsed())
    if (root.current) root.current.visible = a > 0.001
    if (a <= 0.001) return
    matRefs.current.forEach((m) => { if (m) m.opacity = a * 0.55 })
    glowRefs.current.forEach((s) => { if (s) (s.material as THREE.SpriteMaterial).opacity = a * 0.5 })
  })

  return (
    <group ref={root} visible={false}>
      {defs.map((d, i) => (
        <group key={i} position={d.pos as unknown as [number, number, number]} rotation={d.rot as unknown as [number, number, number]}>
          <sprite ref={(el) => { glowRefs.current[i] = el }} scale={[d.maxR * 1.4, d.maxR, 1]}>
            <spriteMaterial map={tex} color={d.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <points frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[geos[i].positions, 3]} />
              <bufferAttribute attach="attributes-color" args={[geos[i].colors, 3]} />
            </bufferGeometry>
            <pointsMaterial ref={(el) => { matRefs.current[i] = el }} map={tex} size={9} sizeAttenuation vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </points>
        </group>
      ))}
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

  useFrame(() => {
    const a = arrived(elapsed())
    if (root.current) root.current.visible = a > 0.001   // not drawn at all during the warp
    if (a <= 0.001) return
    if (starsMat.current) starsMat.current.opacity = a
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
    // multi-sine sway with a faster jitter layer — snappier toward arrival but
    // still continuous (no hard jerks)
    const jx = (Math.sin(t * 16.0) + Math.sin(t * 9.3) * 0.7 + Math.sin(t * 27.0) * 0.4) * tb * 11
    const jy = (Math.sin(t * 13.7) + Math.sin(t * 7.1) * 0.7 + Math.sin(t * 23.0) * 0.4) * tb * 11
    const jr = Math.sin(t * 11.0) * tb * 0.08
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
  // Pause the render loop while resizing/zooming — see lib/interaction.
  const paused = useInteractionPaused()
  const dpr = useBudgetDpr()
  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      camera={{ position: [0, 0, 0], fov: 80, near: 0.1, far: 4000 }}
      gl={{ antialias: !LOW, powerPreference: 'high-performance' }}
      dpr={dpr}
      style={{ background: '#01010a' }}
    >
      <WarpStars />
      <BrightStars />
      <NebulaField />
      <Galaxy />
      <FarGalaxies />
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
