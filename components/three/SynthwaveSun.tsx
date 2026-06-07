'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'

const vert = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const frag = `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c) * 2.0;
    if (dist > 1.0) discard;
    float numBands   = 22.0;
    float bandPos    = mod(vUv.y * numBands, 1.0);
    float gapFraction = mix(0.08, 0.52, 1.0 - vUv.y);
    if (bandPos < gapFraction) discard;
    float alpha = smoothstep(1.0, 0.85, dist) * uOpacity;
    vec3 top    = vec3(1.0, 0.42, 0.21);
    vec3 bottom = vec3(0.93, 0.17, 0.47);
    gl_FragColor = vec4(mix(bottom, top, vUv.y) * alpha, alpha);
  }
`

export default function SynthwaveSun() {
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const smoothOp = useRef(1)

  const uniforms = useMemo(() => ({ uOpacity: { value: 1 } }), [])

  useFrame(() => {
    const p = scrollState.progress
    const target = p < 0.20 ? 1 : Math.max(0, 1 - (p - 0.20) / 0.16)
    smoothOp.current += (target - smoothOp.current) * 0.06
    if (matRef.current) matRef.current.uniforms.uOpacity.value = smoothOp.current
  })

  return (
    <mesh position={[0, 14, -90]}>
      <circleGeometry args={[22, 64]} />
      <shaderMaterial ref={matRef} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  )
}
