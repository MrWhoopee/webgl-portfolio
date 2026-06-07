'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { scrollState } from '@/lib/scroll'

// Purely static mountains — no animation, no hover.
// The "infinite forward motion" illusion comes from SynthwaveGrid's scrolling road.

const vert = /* glsl */`
varying float vHeight;
varying float vFogDepth;

void main() {
  vHeight = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const frag = /* glsl */`
uniform float uOpacity;
varying float vHeight;
varying float vFogDepth;

void main() {
  float t  = clamp(vHeight / 36.0, 0.0, 1.0);
  vec3  c0 = vec3(0.30, 0.06, 0.82);
  vec3  c1 = vec3(0.82, 0.10, 0.62);
  vec3  c2 = vec3(1.00, 0.42, 0.90);
  vec3  col = t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);

  float fog = smoothstep(65.0, 260.0, vFogDepth);
  col = mix(col, vec3(0.03, 0.0, 0.06), fog);

  gl_FragColor = vec4(col, uOpacity);
}
`

function makeLCG(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0x100000000 }
}

export default function SynthwaveMountain() {
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const smoothOp = useRef(1)

  const geo = useMemo(() => {
    const nRidge  = createNoise2D(makeLCG(42))
    const nDetail = createNoise2D(makeLCG(1337))

    const g = new THREE.PlaneGeometry(460, 240, 90, 50)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute

    const VALLEY = 18   // flat road corridor half-width
    const OUTER  = 115  // ridge outer edge

    for (let i = 0; i < pos.count; i++) {
      const x  = pos.getX(i)
      const z  = pos.getZ(i)
      const ax = Math.abs(x)

      let y = 0
      if (ax > VALLEY) {
        const t  = Math.min(1, (ax - VALLEY) / (OUTER - VALLEY))
        const r1 = Math.max(0, nRidge(x * 0.038, z * 0.038)) * 22
        const r2 = Math.max(0, nDetail(x * 0.088, z * 0.088)) * 9
        y = Math.max(0, t * t * t * 30 + r1 + r2)
      }

      pos.setY(i, y < 1.2 ? 0 : y)
    }

    pos.needsUpdate = true
    g.computeVertexNormals()
    return g
  }, [])

  const uniforms = useMemo(() => ({ uOpacity: { value: 1 } }), [])

  useFrame(() => {
    const mat = matRef.current
    if (!mat) return
    const p = scrollState.progress
    const op = p < 0.18 ? 1 : Math.max(0, 1 - (p - 0.18) / 0.14)
    smoothOp.current += (op - smoothOp.current) * 0.07
    mat.uniforms.uOpacity.value = smoothOp.current
  })

  return (
    // Y=-7: aligns mountain valley floor with the road grid plane.
    // Mountain peaks (local Y ≈ 30-40) reach world Y 23-33 → upper screen area.
    <mesh geometry={geo} position={[0, -7, -42]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        wireframe
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
