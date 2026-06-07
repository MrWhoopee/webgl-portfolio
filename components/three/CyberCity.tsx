'use client'
import { useRef, useMemo, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { audioState } from '@/lib/audio'
import { CITY, CITY_Y, CITY_Z, HALF_X, HALF_Z } from '@/lib/cityLayout'
import SkyLanes from './SkyLanes'

/* Scene 3: a dense, multi-tier cyberpunk city. Its ~20 hero towers are laid
   out so each one breaks up through its matching hole in the lower plane; the
   rest is a detailed skyline of setback towers, lit window grids and antennas,
   drowned in neon haze. */
export { CITY_Y, CITY_Z }

const gridGlsl = /* glsl */`
float gridLine(vec2 p, float scale) {
  vec2 g = p * scale;
  vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  return 1.0 - min(min(d.x, d.y), 1.0);
}
`
const groundVert = /* glsl */`
varying vec2  vGrid;
varying float vFog;
void main() {
  vGrid = position.xz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const groundFrag = /* glsl */`
uniform float uOpacity, uLevel;
varying vec2  vGrid;
varying float vFog;
${gridGlsl}
void main() {
  float line = gridLine(vGrid, 0.12);
  if (line < 0.02) discard;
  float r   = clamp(length(vGrid) / 320.0, 0.0, 1.0);
  vec3  col = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.15, 0.85), r);
  col *= 0.14 + uLevel * 0.8;
  float fog = smoothstep(70.0, 360.0, vFog);
  gl_FragColor = vec4(col, uOpacity * line * (1.0 - fog) * 0.35);   // sinks into the low haze
}
`

/* ── Setback tiers: solid faceted bodies with lit neon window grids ── */
const buildingVert = /* glsl */`
attribute vec3  aSize;
attribute float aBand;
attribute vec3  aTint;
varying vec3  vLocal;
varying vec3  vSize;
varying vec3  vN;
varying float vBand;
varying vec3  vTint;
varying float vFog;
varying float vWY;
void main() {
  vLocal = position * aSize;
  vSize = aSize;
  vN = normal;
  vBand = aBand;
  vTint = aTint;
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vWY = wp.y;                                        // height within the city
  vec4 mv = modelViewMatrix * wp;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const buildingFrag = /* glsl */`
uniform sampler2D uSpectrum;
uniform float uTime, uOpacity, uAudio, uLevel;
varying vec3  vLocal;
varying vec3  vSize;
varying vec3  vN;
varying float vBand;
varying vec3  vTint;
varying float vFog;
varying float vWY;
void main() {
  float samp  = texture2D(uSpectrum, vec2(vBand, 0.5)).r;

  // solid faceted body — reads as material, not flat glow (darkened)
  vec3  L    = normalize(vec3(0.4, 0.85, 0.3));
  float ndl  = 0.18 + 0.72 * max(dot(normalize(vN), L), 0.0);
  vec3  col  = mix(vec3(0.02, 0.025, 0.045), vTint * 0.09, 0.5) * ndl;

  // pick the two in-face axes + their half extents, for windows and borders
  vec2 uv, half2;
  if (abs(vN.y) > 0.5)      { uv = vLocal.xz; half2 = vSize.xz * 0.5; }
  else if (abs(vN.x) > 0.5) { uv = vLocal.zy; half2 = vSize.zy * 0.5; }
  else                      { uv = vLocal.xy; half2 = vSize.xy * 0.5; }

  if (abs(vN.y) < 0.5) {                            // walls carry lit windows
    vec2 g    = uv / vec2(2.4, 3.2);
    vec2 cell = floor(g);
    vec2 f    = abs(fract(g) - 0.5);
    float win = smoothstep(0.46, 0.30, max(f.x, f.y));
    float rnd = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float audio = uAudio;
    // music off → only a few sparse windows glow, steady (no flicker)
    float staticLit = step(0.86, rnd);
    col += vTint * win * staticLit * 0.55;
    // music on → many more windows light up and flicker to the beat
    float beatLit = step(0.45, rnd) * (uLevel * 0.7 + samp) * audio;
    float fl      = 0.65 + 0.35 * sin(uTime * 5.0 + rnd * 40.0);
    col += vTint * win * beatLit * fl * 1.3;
  } else {
    col += vTint * 0.05;                            // faint roof glow
  }

  // black border outlining every face edge
  vec2 edge = half2 - abs(uv);
  float bw  = smoothstep(0.55, 0.0, min(edge.x, edge.y));
  col *= 1.0 - bw;                                  // crisp black frame on the grains

  vec3  bg  = vec3(0.0235, 0.0039, 0.0706);          // scene background
  float fog = smoothstep(70.0, 360.0, vFog);         // much thicker haze
  col = mix(col, bg, fog);
  float hfog = smoothstep(64.0, 2.0, vWY);           // dense ground haze swallows the base
  col = mix(col, bg, hfog * 0.92);
  col = mix(bg, col, uOpacity);                      // fade into the haze, stay opaque
  gl_FragColor = vec4(col, 1.0);
}
`

function Tiles() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat  = useRef<THREE.ShaderMaterial>(null)
  const smooth = useRef(0)
  const gate = useRef(0)

  const freq = useMemo(() => new Uint8Array(64), [])
  const spectrum = useMemo(() => {
    const tex = new THREE.DataTexture(freq, freq.length, 1, THREE.RedFormat, THREE.UnsignedByteType)
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true
    return tex
  }, [freq])

  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1)
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(CITY.tiles.size, 3))
    g.setAttribute('aBand', new THREE.InstancedBufferAttribute(CITY.tiles.band, 1))
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(CITY.tiles.tint, 3))
    return g
  }, [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uAudio: { value: 0 },
    uLevel: { value: 0 }, uSpectrum: { value: spectrum },
  }), [spectrum])

  useLayoutEffect(() => {
    if (!mesh.current) return
    const o = new THREE.Object3D()
    const { pos, size, count } = CITY.tiles
    for (let i = 0; i < count; i++) {
      o.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      o.scale.set(size[i * 3], size[i * 3 + 1], size[i * 3 + 2])
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))   // appear as we near the tear
    smooth.current += (op - smooth.current) * 0.06
    const an = audioState.analyser
    const playing = audioState.playing && !!an
    gate.current += ((playing ? 1 : 0) - gate.current) * 0.05   // soft music on/off
    let level = 0
    if (playing) {
      an!.getByteFrequencyData(freq); spectrum.needsUpdate = true
      let s = 0; for (let i = 0; i < 16; i++) s += freq[i]; level = s / (16 * 255)
    }
    if (mat.current) {
      mat.current.uniforms.uTime.value = clock.getElapsedTime()
      mat.current.uniforms.uOpacity.value = smooth.current
      mat.current.uniforms.uAudio.value = gate.current
      const cur = mat.current.uniforms.uLevel.value as number
      const tgt = level * gate.current
      mat.current.uniforms.uLevel.value = tgt > cur ? tgt : cur + (tgt - cur) * 0.08
    }
  })

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, CITY.tiles.count]} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        vertexShader={buildingVert}
        fragmentShader={buildingFrag}
        uniforms={uniforms}
      />
    </instancedMesh>
  )
}

function Antennas() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat  = useRef<THREE.MeshBasicMaterial>(null)
  const smooth = useRef(0)

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const { pos, size, tint, count } = CITY.ants
    for (let i = 0; i < count; i++) {
      o.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      o.scale.set(size[i * 3], size[i * 3 + 1], size[i * 3 + 2])
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
      c.setRGB(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2])
      mesh.current.setColorAt(i, c)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [])

  useFrame(() => {
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))
    smooth.current += (op - smooth.current) * 0.06
    if (mat.current) mat.current.opacity = smooth.current
  })

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, CITY.ants.count]} frustumCulled={false}>
      <meshBasicMaterial
        ref={mat}
        transparent opacity={0} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false}
      />
    </instancedMesh>
  )
}

/* ── Roads: dark ribbons with two streams of running lights (traffic) ── */
const roadVert = /* glsl */`
varying vec2 vUv;
varying float vFog;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const roadFrag = /* glsl */`
uniform float uTime, uOpacity;
varying vec2 vUv;
varying float vFog;
float stream(float v, float t, float seed) {
  float s = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float speed = 0.18 + 0.10 * fract(seed + fi * 0.37);
    float p = fract(v - t * speed + fi * 0.143 + seed);
    s += smoothstep(0.05, 0.0, abs(p - 0.5));      // a moving headlight
  }
  return s;
}
void main() {
  vec3 col = vec3(0.012, 0.014, 0.024);            // asphalt
  float lane = vUv.x;
  float t1 = smoothstep(0.10, 0.0, abs(lane - 0.34));   // outbound lane
  float t2 = smoothstep(0.10, 0.0, abs(lane - 0.66));   // inbound lane
  col += vec3(0.55, 0.85, 1.0) * t1 * stream(vUv.y,  uTime, 0.0) * 1.6;
  col += vec3(1.0, 0.18, 0.22) * t2 * stream(vUv.y, -uTime, 0.4) * 1.6;
  float edge = smoothstep(0.0, 0.03, lane) * smoothstep(1.0, 0.97, lane);
  col += vec3(0.2, 0.7, 1.0) * 0.06 * edge;        // faint curb glow
  float fog = smoothstep(70.0, 360.0, vFog);
  gl_FragColor = vec4(col, uOpacity * (1.0 - fog));
}
`

function Roads() {
  // One uniforms object shared by every road material; updated in place.
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), [])
  const smooth = useRef(0)
  // a couple of avenues running into the city, plus one cross street
  const roads = useMemo(() => ([
    { pos: [-25, 0.4, -70] as [number, number, number], rot: 0, w: 15, l: 420 },
    { pos: [60, 0.4, -90] as [number, number, number], rot: 0, w: 13, l: 400 },
    { pos: [0, 0.4, -180] as [number, number, number], rot: Math.PI / 2, w: 13, l: 280 },
  ]), [])

  useFrame(({ clock }) => {
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))
    smooth.current += (op - smooth.current) * 0.06
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uOpacity.value = smooth.current
  })

  return (
    <>
      {roads.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[-Math.PI / 2, 0, r.rot]} frustumCulled={false}>
          <planeGeometry args={[r.w, r.l]} />
          <shaderMaterial
            vertexShader={roadVert}
            fragmentShader={roadFrag}
            uniforms={uniforms}
            transparent depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  )
}

/* ── Low ground fog: instanced billboard puffs hugging the city floor. Each puff
   is a camera-facing quad with a soft procedural falloff (no texture, no network,
   no suspense) so it reads as a fluffy cloud bank and can never vanish edge-on. ── */
const fogVert = /* glsl */`
attribute vec3  aCenter;
attribute float aScale;
attribute float aSeed;
uniform float uTime;
varying vec2  vUv;
varying float vSeed;
void main() {
  vUv = position.xy + 0.5;
  vSeed = aSeed;
  vec3 c = aCenter;
  c.x += sin(uTime * 0.10 + aSeed * 6.28) * 12.0;     // gentle drift
  c.z += cos(uTime * 0.08 + aSeed * 6.28) * 12.0;
  vec4 view = modelViewMatrix * vec4(c, 1.0);
  view.xy += position.xy * aScale;                     // billboard: offset in view space
  gl_Position = projectionMatrix * view;
}
`
const fogFrag = /* glsl */`
uniform float uOpacity;
varying vec2  vUv;
varying float vSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.02; a*=0.5; } return s; }
void main() {
  float d    = length(vUv - 0.5);
  float soft = smoothstep(0.5, 0.05, d);              // round, feathered puff
  float wisp = fbm(vUv * 4.0 + vSeed * 10.0) * 0.6 + 0.4;
  float a    = soft * wisp * uOpacity * 0.6;
  gl_FragColor = vec4(vec3(0.90, 0.95, 1.0), a);      // bright white mist
}
`

const FOG_N = 70
function GroundFog() {
  const smooth = useRef(0)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), [])

  const geo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    const plane = new THREE.PlaneGeometry(1, 1)
    g.index = plane.index
    g.setAttribute('position', plane.attributes.position)
    g.instanceCount = FOG_N
    const center = new Float32Array(FOG_N * 3), scale = new Float32Array(FOG_N), seed = new Float32Array(FOG_N)
    for (let i = 0; i < FOG_N; i++) {
      center[i * 3]     = (Math.random() * 2 - 1) * HALF_X
      center[i * 3 + 1] = 4 + Math.random() * 26                 // low band, hugging the ground
      center[i * 3 + 2] = (Math.random() * 2 - 1) * HALF_Z * 0.85
      scale[i] = 70 + Math.random() * 90
      seed[i] = Math.random()
    }
    g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(center, 3))
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    return g
  }, [])

  useFrame(({ clock }) => {
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))
    smooth.current += (op - smooth.current) * 0.06
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uOpacity.value = smooth.current
  })

  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={fogVert}
        fragmentShader={fogFrag}
        uniforms={uniforms}
        transparent depthWrite={false} side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function CyberCity() {
  const gMat   = useRef<THREE.ShaderMaterial>(null)
  const lights = useRef<THREE.Group>(null)
  const smooth = useRef(0)

  const groundUniforms = useMemo(() => ({ uOpacity: { value: 0 }, uLevel: { value: 0 } }), [])
  const freq = useMemo(() => new Uint8Array(16), [])
  const gate = useRef(0)
  const lvl  = useRef(0)

  useFrame(() => {
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.34) / 0.12))
    smooth.current += (op - smooth.current) * 0.06
    const o = smooth.current

    const an = audioState.analyser
    const playing = audioState.playing && !!an
    gate.current += ((playing ? 1 : 0) - gate.current) * 0.05
    let level = 0
    if (playing) {
      an!.getByteFrequencyData(freq)
      let s = 0; for (let i = 0; i < 8; i++) s += freq[i]; level = s / (8 * 255)
    }
    const tgt = level * gate.current
    lvl.current += (tgt - lvl.current) * (tgt > lvl.current ? 0.4 : 0.06)   // gentle release
    if (gMat.current) {
      gMat.current.uniforms.uOpacity.value = o
      gMat.current.uniforms.uLevel.value = lvl.current
    }
    if (lights.current)
      lights.current.children.forEach((c, i) => {
        const l = c as THREE.PointLight
        l.intensity = o * (2.2 + lvl.current * 7) * (0.6 + 0.4 * Math.sin(performance.now() * 0.001 * (1 + i)))
      })
  })

  return (
    <group position={[0, CITY_Y, CITY_Z]}>
      {/* tusklі неонові вогні над містом */}
      <group ref={lights}>
        <pointLight color="#00f3ff" position={[60, 80, 40]} distance={320} decay={1.4} intensity={0} />
        <pointLight color="#ff2bd6" position={[-90, 60, -30]} distance={320} decay={1.4} intensity={0} />
        <pointLight color="#7a5cff" position={[0, 120, -70]} distance={360} decay={1.4} intensity={0} />
        <pointLight color="#9fe8ff" position={[40, 30, 90]} distance={260} decay={1.6} intensity={0} />
      </group>
      <ambientLight intensity={0.04} color="#16243a" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[HALF_X * 2, HALF_Z * 2]} />
        <shaderMaterial
          ref={gMat}
          vertexShader={groundVert}
          fragmentShader={groundFrag}
          uniforms={groundUniforms}
          transparent side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>

      <Roads />
      <Tiles />
      <Antennas />
      <SkyLanes />
      <GroundFog />
    </group>
  )
}
