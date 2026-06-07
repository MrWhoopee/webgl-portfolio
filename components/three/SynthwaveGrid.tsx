'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'

// Single large quad — grid is drawn entirely in the fragment shader.
// No geometry subdivisions needed: UV interpolates linearly across the plane.

const vert = /* glsl */`
varying vec2  vUv;
varying float vFogDist;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const frag = /* glsl */`
uniform float uTime;
uniform float uOpacity;
varying vec2  vUv;
varying float vFogDist;

void main() {
  // vUv.y = 0 is near camera, 1 is at horizon (see rotateX note in component)

  // ── Horizontal lines scrolling toward camera ─────────────────────────────
  float h = fract(vUv.y * 34.0 + uTime * 0.22);
  float hLine = step(0.88, h);

  // ── Vertical lane dividers (static) ─────────────────────────────────────
  float v = fract(vUv.x * 10.0);
  float vLine = step(0.96, v) + step(0.96, 1.0 - v);   // two symmetric edges

  float grid = clamp(hLine + vLine, 0.0, 1.0);
  if (grid < 0.5) discard;

  // Purple near → pink/magenta at horizon
  vec3 col = mix(vec3(0.48, 0.04, 0.90), vec3(0.92, 0.10, 0.54), vUv.y);

  // Depth fade: fade in near camera, fade out at horizon
  float nearFade = smoothstep(0.0, 22.0, vFogDist);
  float farFade  = 1.0 - smoothstep(85.0, 230.0, vFogDist);
  float alpha    = uOpacity * nearFade * farFade;
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(col, alpha);
}
`

export default function SynthwaveGrid() {
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const smoothOp = useRef(1)

  // Single quad — grid detail lives entirely in the fragment shader
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(600, 600, 1, 1)
    // After rotateX(-PI/2): original bottom (UV.y=0) → world Z near camera,
    //                        original top (UV.y=1) → world Z at horizon
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uOpacity: { value: 1 },
  }), [])

  useFrame(({ clock }) => {
    const mat = matRef.current
    if (!mat) return
    const p = scrollState.progress
    const target = p < 0.20 ? 1 : Math.max(0, 1 - (p - 0.20) / 0.16)
    smoothOp.current += (target - smoothOp.current) * 0.06
    mat.uniforms.uOpacity.value = smoothOp.current
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    // Y=-7 places the road below the mountain valley (mountain mesh at Y=-7 too).
    // Z=-50 centres the 600-deep plane so its near edge is behind the camera
    // and far edge disappears into the depth fog.
    <mesh geometry={geo} position={[0, -7, -50]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
