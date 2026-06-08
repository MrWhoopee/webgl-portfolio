'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eggState } from '@/lib/egg'

/* The detonation: a blast sphere that rips outward fast, then lingers as a
   glowing fireball for the hold beat before the warp scene takes over. Shown
   only while phase === 'exploding'. */
const vert = /* glsl */`
varying vec3 vN; varying vec3 vView;
void main() {
  vN = normalMatrix * normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const frag = /* glsl */`
uniform float uT;            // 0..1 explosion progress
varying vec3 vN; varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 1.5);
  vec3 hot = mix(vec3(1.0), vec3(1.0, 0.32, 0.04), uT);   // white-hot → red
  float a = (1.0 - uT) * (0.5 + rim);
  gl_FragColor = vec4(hot * (1.5 - uT), a);
}
`

export default function CoreExplosion({ radius }: { radius: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(radius, 5), [radius])
  const uniforms = useMemo(() => ({ uT: { value: 0 } }), [])

  useFrame(() => {
    const te = (performance.now() - eggState.explodeAt) / 1000   // seconds since detonation
    const burst = Math.min(1, te / 0.8)                          // fast rip-out (0..0.8s)
    const ease = 1 - Math.pow(1 - burst, 3)
    // colour goes white→red over the burst; afterglow lingers and slowly cools
    const linger = Math.max(0, 1 - (te - 0.8) / 2.0)             // fades ~2s after the burst
    if (mesh.current) mesh.current.scale.setScalar(0.6 + ease * 8)
    if (mat.current) mat.current.uniforms.uT.value = burst * 0.7 + (1 - linger) * 0.3
    if (light.current) light.current.intensity = (1 - burst) * 700 + linger * 250
  })

  return (
    <group>
      <pointLight ref={light} color="#ffb37a" distance={2000} decay={1.0} />
      <mesh ref={mesh} geometry={geo} frustumCulled={false}>
        <shaderMaterial
          ref={mat}
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
