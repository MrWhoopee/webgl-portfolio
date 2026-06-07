'use client'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioState } from '@/lib/audio'

/* Neon light-blue streaks that spawn at the cursor, rise and fade away.
   Rendered as additive LineSegments — one short vertical segment per particle. */
const POOL  = 160
const LIFE  = 1.6          // seconds
const EMIT  = 50           // particles / sec (only while music plays)
const COLOR = '#8fdfff'

const vert = /* glsl */ `
  attribute float aAlpha;
  varying float vA;
  void main() {
    vA = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor, vA); }
`

export default function HoverParticles() {
  const { camera } = useThree()

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL * 2 * 3), 3))
    g.setAttribute('aAlpha',   new THREE.BufferAttribute(new Float32Array(POOL * 2), 1))
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(COLOR) } },
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  // Per-particle state (SoA, allocation-free in the loop)
  const P = useMemo(
    () => ({
      x:    new Float32Array(POOL),
      y:    new Float32Array(POOL),
      z:    new Float32Array(POOL),
      vx:   new Float32Array(POOL),
      vy:   new Float32Array(POOL),
      len:  new Float32Array(POOL),
      life: new Float32Array(POOL), // remaining seconds, 0 = dead
    }),
    []
  )

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ground    = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 2), []) // y = -2
  const hit       = useMemo(() => new THREE.Vector3(), [])
  const cursor    = useRef(new THREE.Vector3(0, -2, -30))
  const carry     = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)

    raycaster.setFromCamera(state.pointer, camera)
    if (raycaster.ray.intersectPlane(ground, hit)) cursor.current.copy(hit)

    const pos = geo.attributes.position.array as Float32Array
    const al  = geo.attributes.aAlpha.array as Float32Array

    // Emit only while music plays; existing streaks finish their fade-out.
    carry.current += (audioState.playing ? EMIT : 0) * dt
    let spawn = Math.floor(carry.current)
    carry.current -= spawn

    for (let i = 0; i < POOL; i++) {
      if (P.life[i] > 0) {
        P.life[i] -= dt
        P.y[i] += P.vy[i] * dt
        P.x[i] += P.vx[i] * dt
      } else if (spawn > 0) {
        spawn--
        P.x[i]   = cursor.current.x + (Math.random() - 0.5) * 11
        P.z[i]   = cursor.current.z + (Math.random() - 0.5) * 11
        P.y[i]   = -2 + Math.random() * 1.5
        P.vx[i]  = (Math.random() - 0.5) * 2
        P.vy[i]  = 5 + Math.random() * 11
        P.len[i] = 1.5 + Math.random() * 6.5
        P.life[i] = LIFE * (0.5 + Math.random() * 0.5)
      }

      const a = P.life[i] > 0 ? Math.min(1, P.life[i] / LIFE) : 0
      const o = i * 6
      pos[o]     = P.x[i]                       // tail
      pos[o + 1] = P.y[i]
      pos[o + 2] = P.z[i]
      pos[o + 3] = P.x[i] + P.vx[i] * 0.12      // head (slight lean with motion)
      pos[o + 4] = P.y[i] + P.len[i]
      pos[o + 5] = P.z[i]
      al[i * 2]     = a * 0.12                  // faint tail
      al[i * 2 + 1] = a                         // bright head
    }

    geo.attributes.position.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
  })

  return <lineSegments geometry={geo} material={material} frustumCulled={false} />
}
