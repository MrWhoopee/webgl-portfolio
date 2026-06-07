'use client'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* ---- Tunables ------------------------------------------------------------ */
const SIZE         = 100        // plane span (X and local-Y), per spec
const SEG          = 250        // grid density (250×250)
const HEIGHT       = 8.0        // mountain amplitude scalar (spec: * 8.0)
const RADIUS       = 12.0       // mouse hover radius (plane units)
const SCROLL_SPEED = 6.0        // Outrun highway speed (units / sec)
const LERP         = 0.09       // mouse dampening (organic follow)

type Props = {
  glow?: string          // neon glow color: '#ff007f' | '#00f3ff'
  audioPlaying?: boolean // gates the equalizer vibration
}

const vertexShader = /* glsl */ `
  uniform vec2  uMouse;
  uniform float uTime;
  uniform bool  uAudioActive;  // true while the synthwave track is playing
  uniform float uHoverRadius;  // mouse influence radius (plane units)

  varying float vGlow;
  varying float vHeight;
  varying float vFog;
  varying float vLocalY;       // local plane Y → drives the dual-ended dissolve

  const float HEIGHT = ${HEIGHT.toFixed(1)};
  const float SPEED  = ${SCROLL_SPEED.toFixed(2)};

  /* ---- Ashima 2D simplex noise -------------------------------------- */
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec3 pos = position;

    // ---- Infinite forward scroll: shift the NOISE INPUT, not the mesh ----
    // Smooth, unwrapped coordinate fed straight into the noise — no fract/step
    // tiling, so no horizontal seam lines march down the highway.
    float scrollY = position.y - (uTime * SPEED);

    // High-frequency fBm → dense, jagged ridges
    float n  = snoise(vec2(position.x * 0.045, scrollY * 0.045));
    n       += snoise(vec2(position.x * 0.11,  scrollY * 0.11)) * 0.45;
    n        = n * 0.5 + 0.5;                 // 0..1
    n        = n * n;                         // square → sharpen peaks

    // Steep cliffs on the edges, clean flat "highway" valley in the centre
    float amplitude = smoothstep(8.0, 35.0, abs(position.x)) * HEIGHT;
    float height    = n * amplitude;

    // ---- Mouse hover: jittering equalizer (audio ON) / smooth lift (OFF) --
    float distToMouse = distance(position.xy, uMouse);
    float infl = 1.0 - clamp(distToMouse / uHoverRadius, 0.0, 1.0);  // 1 at cursor → 0 at edge

    if (uAudioActive && distToMouse < uHoverRadius) {
        // Sharp jagged steps like equalizer bars via a floor/sin combo
        float jaggedFactor = floor(sin(position.x * 5.0) * 2.0) + 1.0;
        // High-speed (35Hz) vertical vibration linked to time
        float equalizerVibration = sin(uTime * 35.0) * jaggedFactor * 0.6;
        // Base lift + aggressive jitter
        height += (1.0 - (distToMouse / uHoverRadius)) * (4.0 + equalizerVibration);
    } else if (!uAudioActive && distToMouse < uHoverRadius) {
        // Smooth standard lift when the music is OFF
        height += (1.0 - (distToMouse / uHoverRadius)) * 3.0;
    }

    pos.z = height;

    vHeight = height;
    vLocalY = position.y;
    vGlow   = infl;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vFog = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3  uBase;
  uniform vec3  uGlow;
  uniform vec3  uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAlpha;        // base wireframe opacity

  varying float vGlow;
  varying float vHeight;
  varying float vFog;
  varying float vLocalY;

  void main() {
    float peak = clamp(vHeight / 7.0, 0.0, 1.0);
    vec3  col  = mix(uBase, uGlow, max(vGlow, peak * 0.6));
    col       += uGlow * vGlow * 1.8;             // hover emissive → Bloom

    float fog = smoothstep(uFogNear, uFogFar, vFog);
    col = mix(col, uFog, fog);

    // ---- Dual-ended alpha dissolve (geometry-locked, no hard cut) --------
    float nearFade = smoothstep(-50.0, -30.0, vLocalY);   // dissolves at the near screen edge
    float farFade  = 1.0 - smoothstep(10.0, 50.0, vLocalY); // dissolves into the horizon fog
    float alpha    = uAlpha * nearFade * farFade;

    gl_FragColor = vec4(col, alpha);
  }
`

export default function InteractiveTerrain({ glow = '#ff007f', audioPlaying = false }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const playing = useRef(audioPlaying)
  playing.current = audioPlaying

  /* Flat plane — all elevation is generated on the GPU ------------------ */
  const geometry = useMemo(() => new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG), [])

  const uniforms = useMemo(() => ({
    uMouse:        { value: new THREE.Vector2(9999, 9999) },
    uTime:         { value: 0 },
    uAudioActive:  { value: false },
    uHoverRadius:  { value: RADIUS },
    uBase:    { value: new THREE.Color('#2e1065') },
    uGlow:    { value: new THREE.Color(glow) },
    uFog:     { value: new THREE.Color('#060112') },
    uFogNear: { value: 25 },
    uFogFar:  { value: 85 },
    uAlpha:   { value: 0.85 },
  }), [glow])

  /* Pre-allocated scratch — nothing is `new`-ed inside useFrame --------- */
  const raycaster   = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 2), []) // y = -2
  const hit         = useMemo(() => new THREE.Vector3(), [])
  const target      = useMemo(() => new THREE.Vector2(0, 0), [])

  useFrame((state, delta) => {
    uniforms.uTime.value += delta
    uniforms.uAudioActive.value = playing.current

    // Project the cursor onto the ground plane (allocation-free)
    raycaster.setFromCamera(state.pointer, camera)
    if (raycaster.ray.intersectPlane(groundPlane, hit) && meshRef.current) {
      meshRef.current.worldToLocal(hit)
      target.set(hit.x, hit.y)
    }

    const m = uniforms.uMouse.value
    m.x += (target.x - m.x) * LERP
    m.y += (target.y - m.y) * LERP
  })

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -30]}>
      <shaderMaterial
        wireframe
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}
