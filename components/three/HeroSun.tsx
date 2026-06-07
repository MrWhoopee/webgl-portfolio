'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Classic synthwave digital sun — sits on the horizon behind the mountains.
   Orange→pink gradient with animated horizontal scan-line cut-outs.        */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uTop;     // #ff5e00
  uniform vec3  uBottom;  // #ff007f
  varying vec2  vUv;

  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c) * 2.0;
    if (dist > 1.0) discard;                       // circle mask

    // vertical neon gradient
    vec3 col = mix(uBottom, uTop, vUv.y);

    // horizontal stripe cut-outs, drifting slowly upward; gaps widen at the base
    float bands  = 16.0;
    float band   = fract((vUv.y - uTime * 0.06) * bands);
    float gap    = mix(0.08, 0.62, 1.0 - vUv.y);   // thin at top → thick at bottom
    if (band < gap && vUv.y < 0.5) discard;        // stripes only on lower half

    float edge = smoothstep(1.0, 0.88, dist);      // soft rim
    col *= 1.0 + (1.0 - vUv.y) * 0.4;              // hotter core toward bottom
    gl_FragColor = vec4(col * edge, edge);
  }
`

export default function HeroSun() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uTop:    { value: new THREE.Color('#ff5e00') },
    uBottom: { value: new THREE.Color('#ff007f') },
  }), [])

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta
  })

  return (
    <mesh position={[0, 11, -68]}>
      <circleGeometry args={[20, 96]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}
