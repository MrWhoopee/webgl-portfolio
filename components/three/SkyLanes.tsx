'use client'
import { useRef, useMemo, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { audioState } from '@/lib/audio'
import { CITY } from '@/lib/cityLayout'

/* Elevated highways threading the skyline like flat roads. Each runs at a
   constant height on one of three decks (low / mid / high); it stays straight
   and only bends sideways — with rounded curves — to weave around the few
   towers that poke up into its deck. When the music plays, lit vehicles glide
   along them; they coast to a stop and fade out when it stops. */

const LANE_HW = 3.0     // ribbon half-width
const SEG     = 220     // samples along a lane
const MARGIN  = LANE_HW + 5

type Lane = { axis: 'x' | 'z'; fixed: number; y: number; a: number; b: number }

// Three decks: 3 lanes on the main deck, 3 higher, 2 lower — all above the
// filler skyline (~94) so the only obstacles are the sparse hero towers.
const LANES: Lane[] = [
  { axis: 'x', fixed: -70,  y: 122, a: -150, b: 150 },   // main deck (122)
  { axis: 'x', fixed: -200, y: 122, a: -150, b: 150 },
  { axis: 'z', fixed: 60,   y: 122, a: 30, b: -262 },
  { axis: 'x', fixed: -40,  y: 144, a: -150, b: 150 },   // upper deck (144)
  { axis: 'z', fixed: 10,   y: 144, a: 30, b: -262 },
  { axis: 'z', fixed: -110, y: 144, a: 30, b: -262 },
  { axis: 'x', fixed: -130, y: 102, a: -150, b: 150 },   // lower deck (102)
  { axis: 'z', fixed: 95,   y: 102, a: 30, b: -262 },
]

// Sideways offset needed at primary coord `u` so the ribbon clears any tower
// rising above the deck height `y`.
function dodge(axis: 'x' | 'z', u: number, v0: number, y: number) {
  const { pos, size, count } = CITY.tiles
  let mag = 0
  for (let i = 0; i < count; i++) {
    const top = pos[i * 3 + 1] + size[i * 3 + 1] * 0.5
    if (top <= y + 1) continue
    const px = pos[i * 3], pz = pos[i * 3 + 2], sx = size[i * 3], sz = size[i * 3 + 2]
    const pu = axis === 'x' ? px : pz, pv = axis === 'x' ? pz : px
    const hu = (axis === 'x' ? sx : sz) * 0.5 + MARGIN
    const hv = (axis === 'x' ? sz : sx) * 0.5 + MARGIN
    if (Math.abs(u - pu) <= hu && Math.abs(v0 - pv) <= hv) {
      const target = v0 < pv ? pv - hv : pv + hv      // swing to the nearer side
      const d = target - v0
      if (Math.abs(d) > Math.abs(mag)) mag = d
    }
  }
  return mag
}

function buildLane(spec: Lane) {
  const { axis, fixed, y, a, b } = spec
  const us: number[] = [], need: number[] = []
  for (let i = 0; i <= SEG; i++) {
    const u = a + (b - a) * (i / SEG)
    us.push(u); need.push(dodge(axis, u, fixed, y))
  }
  // dilate so the swerve starts before the tower and returns after it
  const W = 7
  const dil = need.map((_, i) => {
    let m = 0
    for (let k = -W; k <= W; k++) { const j = i + k; if (j >= 0 && j <= SEG && Math.abs(need[j]) > Math.abs(m)) m = need[j] }
    return m
  })
  // smooth into rounded bends, then re-assert full clearance at real obstacles
  const off = dil.slice()
  for (let pass = 0; pass < 8; pass++)
    for (let i = 1; i < SEG; i++) off[i] = (off[i - 1] + off[i] + off[i + 1]) / 3
  for (let i = 0; i <= SEG; i++) if (need[i] !== 0) off[i] = need[i]

  const pts = us.map((u, i) => {
    const v = fixed + off[i]
    return axis === 'x' ? new THREE.Vector3(u, y, v) : new THREE.Vector3(v, y, u)
  })
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)

  // ribbon: edges offset sideways from the spaced curve
  const sp = curve.getSpacedPoints(SEG)
  const up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3(), side = new THREE.Vector3()
  const position: number[] = [], uv: number[] = [], index: number[] = []
  for (let i = 0; i <= SEG; i++) {
    tan.copy(curve.getTangentAt(i / SEG))
    side.crossVectors(tan, up).normalize().multiplyScalar(LANE_HW)
    const p = sp[i]
    position.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z)
    uv.push(0, i * 0.12, 1, i * 0.12)
    if (i < SEG) { const j = i * 2; index.push(j, j + 1, j + 2, j + 1, j + 3, j + 2) }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(index)
  return { curve, geo }
}

const ribbonVert = /* glsl */`
varying vec2 vUv;
varying float vFog;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const ribbonFrag = /* glsl */`
uniform float uTime, uOpacity;
varying vec2 vUv;
varying float vFog;
void main() {
  float edge   = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
  float center = smoothstep(0.12, 0.0, abs(vUv.x - 0.5));
  float flow   = fract(vUv.y - uTime * 0.5);
  float dash   = smoothstep(0.5, 0.0, abs(flow - 0.5)) * center;     // running center light
  vec3 col = vec3(0.08, 0.4, 0.85) * edge * 0.45 + vec3(0.5, 0.85, 1.0) * dash * 1.0;
  float fog = smoothstep(70.0, 360.0, vFog);
  gl_FragColor = vec4(col, uOpacity * (edge * 0.3 + dash) * (1.0 - fog));
}
`

const NCARS = 30
const CAR_COLORS: [number, number, number][] = [
  [0.45, 0.8, 1.0], [0.9, 0.95, 1.0], [1.0, 0.55, 0.25], [0.85, 0.35, 0.9],
]

// Deterministic seed for the fleet — pure, so it never trips React-Compiler rules.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function SkyLanes() {
  const cars      = useRef<THREE.InstancedMesh>(null)
  const carMat    = useRef<THREE.MeshBasicMaterial>(null)
  const smooth    = useRef(0)
  const gate      = useRef(0)

  // each lane owns its own uniforms so every ribbon animates (not just one)
  const lanes = useMemo(() => LANES.map((spec) => ({
    ...buildLane(spec),
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
  })), [])
  const carGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.8, 4.4), [])

  const fleet = useMemo(() => {
    const rnd = mulberry32(0x5eed42)
    return Array.from({ length: NCARS }, (_, i) => ({
      lane: i % lanes.length,
      t: rnd(),
      speed: (0.03 + rnd() * 0.03) * (rnd() < 0.5 ? 1 : -1),   // both directions
    }))
  }, [lanes])

  const tmp = useMemo(() => new THREE.Object3D(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    if (!cars.current) return
    const c = new THREE.Color()
    fleet.forEach((_, i) => { const t = CAR_COLORS[i % CAR_COLORS.length]; c.setRGB(t[0], t[1], t[2]); cars.current!.setColorAt(i, c) })
    if (cars.current.instanceColor) cars.current.instanceColor.needsUpdate = true
  }, [fleet])

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))
    smooth.current += (op - smooth.current) * 0.06
    const o = smooth.current
    const playing = audioState.playing && !!audioState.analyser
    gate.current += ((playing ? 1 : 0) - gate.current) * 0.04   // soft start/stop

    lanes.forEach((l) => { l.uniforms.uTime.value = t; l.uniforms.uOpacity.value = o })
    if (carMat.current) carMat.current.opacity = o * gate.current

    if (cars.current) {
      const move = dt * gate.current
      fleet.forEach((f, i) => {
        f.t = (f.t + f.speed * move + 1) % 1
        const curve = lanes[f.lane].curve
        curve.getPointAt(f.t, pos)
        curve.getTangentAt(f.t, tan)
        if (f.speed < 0) tan.negate()
        tmp.position.copy(pos)
        tmp.lookAt(pos.x + tan.x, pos.y + tan.y, pos.z + tan.z)
        tmp.updateMatrix()
        cars.current!.setMatrixAt(i, tmp.matrix)
      })
      cars.current.instanceMatrix.needsUpdate = true
      cars.current.visible = o > 0.02
    }
  })

  return (
    <group>
      {lanes.map((l, i) => (
        <mesh key={i} geometry={l.geo} frustumCulled={false}>
          <shaderMaterial
            vertexShader={ribbonVert}
            fragmentShader={ribbonFrag}
            uniforms={l.uniforms}
            transparent depthWrite={false} side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      <instancedMesh ref={cars} args={[carGeo, undefined, NCARS]} frustumCulled={false}>
        <meshBasicMaterial ref={carMat} transparent opacity={0} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
