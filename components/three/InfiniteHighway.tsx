'use client'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioState } from '@/lib/audio'

// Phones have no cursor — pin the hover wave to a fixed spot on the right of the
// viewport (mesh-local coords) so it never tracks taps over the page content.
const PHONE_HOVER_X = 8
const PHONE_HOVER_Y = -2

/* ── Tunables ───────────────────────────────────────────────────────────── */
const WIDTH   = 120    // plane span across the road (X)
const HALF    = 160    // plane half-length along travel → length = 2*HALF
const PERIOD  = 120    // travel period: terrain tiles every PERIOD units (loop length)
const SPEED   = 8.0    // forward travel speed (units / sec)
const HEIGHT  = 10.0   // ridge amplitude
const HOVER_R = 16.0   // hover wave radius (local units)
const LERP    = 0.12   // cursor follow damping

type Props = {
  base?: string
  glow?: string
  phone?: boolean
}

/*
 * Seamless infinite scroll (see notes): the height field is PERIODIC along the
 * travel axis, baked from the un-scrolled y, then the whole field is marched
 * toward the camera by a uniform `uScroll`. Because it tiles at PERIOD and the
 * shift wraps there, the loop is invisible while terrain regenerates.
 *
 * Hover wave: the cursor is projected onto the ground in WORLD space and fed in
 * as `uMouse` (mesh-local). Each vertex measures distance from its *scrolled*
 * position to uMouse, so the wave stays pinned under the cursor and the moving
 * landscape flows through it.
 */
const vertexShader = /* glsl */ `
  uniform float uScroll;   // 0..PERIOD, forward travel
  uniform float uTime;
  uniform vec2  uMouse;    // cursor on the ground, mesh-local
  uniform float uHoverR;
  uniform float uAudio;    // 1 while music plays → glitch equalizer mode
  uniform float uLevel;    // 0..1 live beat level
  uniform sampler2D uSpectrum; // live FFT, one texel per frequency band
  uniform float uBands;    // band count in uSpectrum

  varying float vH;
  varying float vY;        // scrolled travel coord → drives the dissolve
  varying float vFog;
  varying float vGlow;     // hover emissive (pink EQ)

  const float PERIOD = ${PERIOD.toFixed(1)};
  const float HEIGHT = ${HEIGHT.toFixed(1)};
  const float TWO_PI = 6.28318530718;

  /* Ashima 3D simplex noise */
  vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m*m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  /* Ridged fBm sampled on a ring → periodic in y with period PERIOD */
  float terrain(float x, float y){
    float ang = TWO_PI * y / PERIOD;
    vec3 p = vec3(x * 0.045, cos(ang) * 3.0, sin(ang) * 3.0);
    float a = 0.5, sum = 0.0, norm = 0.0;
    for (int i = 0; i < 4; i++){
      float n = 1.0 - abs(snoise(p));   // ridged
      sum  += n * n * a;
      norm += a;
      p *= 2.03; a *= 0.5;
    }
    return sum / norm;
  }

  void main(){
    vec3 pos = position;

    float amp = smoothstep(8.0, 38.0, abs(position.x)) * HEIGHT;  // flat road, jagged edges
    float h   = terrain(position.x, position.y) * amp;

    float y = position.y - uScroll;   // march the whole field toward the camera
    pos.y = y;

    // Hover deformation — pinned under the cursor. Smooth waves normally, or a
    // glitchy beat-reactive equalizer that flings grid shards upward with music.
    float d    = distance(vec2(position.x, y), uMouse);
    float infl = 1.0 - smoothstep(0.0, uHoverR, d);
    infl *= infl;

    float add;
    float emit = infl;
    if (uAudio > 0.5) {
      // Real spectrum analyser: x across the hover → frequency band (low→high)
      float bx   = clamp((position.x - uMouse.x) / (uHoverR * 2.0) + 0.5, 0.0, 1.0);
      float bi   = floor(bx * uBands);
      float samp = texture2D(uSpectrum, vec2((bi + 0.5) / uBands, 0.5)).r;
      float amp  = pow(clamp(samp * 1.7, 0.0, 1.0), 1.25);      // gain + gentle contrast
      float bar  = floor(amp * 26.0);                           // taller, blocky EQ bars

      // per-cell glitch + beat shards leaping off the bar tops
      vec2  id    = floor(vec2(position.x, y) * 0.5);
      float rnd   = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
      float phase = fract(uTime * 4.0 + rnd);
      float pop   = pow(1.0 - phase, 4.0);
      float flick = step(0.25, fract(rnd * 7.0 + uTime * 12.0));

      add  = infl * (bar + amp * 12.0 * pop * flick);
      emit = infl * (0.3 + amp * 2.2 + pop * flick * 0.6);
    } else {
      float wave = sin(d * 0.55 - uTime * 5.0) * 0.5 + 0.5;
      add = infl * (5.0 + wave * 3.5);
    }
    h += add;

    pos.z = h;
    vH = h;
    vY = y;
    vGlow = emit;
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
  uniform float uAlpha;

  varying float vH;
  varying float vY;
  varying float vFog;
  varying float vGlow;

  const float HEIGHT = ${HEIGHT.toFixed(1)};

  void main(){
    float peak = clamp(vH / HEIGHT, 0.0, 1.0);
    vec3  col  = mix(uBase, uGlow, pow(peak, 0.6));
    col += uGlow * peak * 1.6;          // additive ridge bloom
    col += uGlow * vGlow * 1.8;         // hover emissive → Bloom

    float fog = smoothstep(uFogNear, uFogFar, vFog);
    col = mix(col, uFog, fog);

    // Only the horizon dissolves; the near end runs to the bottom of the viewport.
    float farFade = 1.0 - smoothstep(10.0, 30.0, vY);
    float alpha = uAlpha * farFade * (1.0 - fog * 0.85);

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

export default function InfiniteHighway({
  base = '#2e1065',
  glow = '#ff007f',
  phone = false,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { camera } = useThree()

  const segs = useMemo(() => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768
    return mobile ? { x: 100, y: 180 } : { x: 160, y: 320 }
  }, [])

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(WIDTH, HALF * 2, segs.x, segs.y),
    [segs]
  )

  // Live FFT bands, uploaded to the GPU as a 64×1 texture (one texel per band)
  const freq = useMemo(() => new Uint8Array(64), [])
  const spectrum = useMemo(() => {
    const tex = new THREE.DataTexture(freq, freq.length, 1, THREE.RedFormat, THREE.UnsignedByteType)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [freq])

  const uniforms = useMemo(
    () => ({
      uScroll:   { value: 0 },
      uTime:     { value: 0 },
      uMouse:    { value: new THREE.Vector2(phone ? PHONE_HOVER_X : 9999, phone ? PHONE_HOVER_Y : 9999) },
      uHoverR:   { value: HOVER_R },
      uAudio:    { value: 0 },
      uLevel:    { value: 0 },
      uSpectrum: { value: spectrum },
      uBands:    { value: freq.length },
      uBase:    { value: new THREE.Color(base) },
      uGlow:    { value: new THREE.Color(glow) },
      uFog:     { value: new THREE.Color('#060112') },
      uFogNear: { value: 30 },
      uFogFar:  { value: 95 },
      uAlpha:   { value: 0.9 },
    }),
    [base, glow, spectrum, freq]
  )

  // Allocation-free cursor projection scratch
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ground    = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 2), []) // y = -2
  const hit       = useMemo(() => new THREE.Vector3(), [])
  const target    = useMemo(
    () => new THREE.Vector2(phone ? PHONE_HOVER_X : 9999, phone ? PHONE_HOVER_Y : 9999),
    []
  )

  useFrame((state, delta) => {
    const m = matRef.current
    if (!m) return
    const dt = Math.min(delta, 0.05)
    m.uniforms.uTime.value += dt
    m.uniforms.uScroll.value = (m.uniforms.uScroll.value + dt * SPEED) % PERIOD

    // Live beat level from the shared analyser (bass-weighted), fast attack / slow release
    let level = 0
    const an = audioState.analyser
    const playing = audioState.playing && !!an
    if (playing) {
      an!.getByteFrequencyData(freq)   // fills the texture buffer in place
      spectrum.needsUpdate = true
      let s = 0
      for (let i = 0; i < 12; i++) s += freq[i]
      level = s / (12 * 255)
    }
    m.uniforms.uAudio.value = playing ? 1 : 0
    const cur = m.uniforms.uLevel.value
    m.uniforms.uLevel.value = level > cur ? level : cur + (level - cur) * 0.18

    // Phone: pin the wave to the fixed right-side spot (ignore taps). Desktop/
    // tablet: track the cursor. Toggles live when the viewport crosses the bp.
    if (phone) {
      target.set(PHONE_HOVER_X, PHONE_HOVER_Y)
    } else {
      raycaster.setFromCamera(state.pointer, camera)
      if (raycaster.ray.intersectPlane(ground, hit) && meshRef.current) {
        meshRef.current.worldToLocal(hit)
        target.set(hit.x, hit.y)
      }
    }
    const mouse = m.uniforms.uMouse.value
    mouse.x += (target.x - mouse.x) * LERP
    mouse.y += (target.y - mouse.y) * LERP
  })

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -30]}>
      <shaderMaterial
        ref={matRef}
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
