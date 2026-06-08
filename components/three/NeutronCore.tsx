'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { audioState } from '@/lib/audio'
import { LOW, FBM } from '@/lib/quality'
import { CITY_Y, CITY_Z } from './CyberCity'

/* A neon-blue star-core deep below the city, housed in a vast machine room of
   pipes and switch panels. Its whole surface boils (granulation + flares) and
   pulses with the spectrum, while a forest of energy cables climbs from it up
   to the city base — the core powers everything above. */
const CORE_Y = -490
const RADIUS = 55
const NCABLES = 64

/* ───────────────────────────  STAR CORE  ───────────────────────────
   An HD blue sun: fine granulation, drifting sunspots, solar flares and a
   live equalizer that glitches the whole surface to the music.            */
const noiseGlsl = /* glsl */`
#define FBM ${FBM}
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float noise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<FBM;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
`
const coreVert = /* glsl */`
uniform float uTime, uLevel, uAudio;
uniform sampler2D uSpectrum;
varying float vDisp;
varying vec3  vN;
varying vec3  vView;
varying vec3  vDir;
${noiseGlsl}
void main() {
  vec3 n = normalize(position);
  // FFT band scattered in patches over the WHOLE sphere (not a left→right sweep)
  float band  = noise(n * 3.0);
  float samp  = texture2D(uSpectrum, vec2(band, 0.5)).r;
  float audio = uAudio;
  float relief = fbm(n * 5.0 + uTime * 0.12) - 0.5;               // fine HD surface relief
  float disp   = relief * 3.2 + (uLevel * 4.0 + samp * 9.0) * audio;  // whole-surface equalizer
  vec3  pos = position + n * disp;
  vDisp = disp;
  vDir = n;
  vN = normalMatrix * n;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const coreFrag = /* glsl */`
uniform float uTime, uOpacity, uLevel, uAudio;
uniform sampler2D uSpectrum;
varying float vDisp;
varying vec3  vN;
varying vec3  vView;
varying vec3  vDir;
${noiseGlsl}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);

  // boiling granulation (advected like the sun's photosphere)
  vec3  q    = vDir * 6.0 + uTime * 0.15;
  float gran = fbm(q) * 0.7 + fbm(q * 3.1 - uTime * 0.2) * 0.3;

  // dark drifting sunspots
  float spot = smoothstep(0.60, 0.80, fbm(vDir * 2.0 - uTime * 0.03));

  // fluid plasma filaments — domain-warped, advected so they stream like liquid
  vec3 warp = vec3(fbm(vDir * 3.0 + uTime * 0.20),
                   fbm(vDir * 3.0 + 5.2 - uTime * 0.15),
                   fbm(vDir * 3.0 + 9.1 + uTime * 0.18));
  float fil = fbm(vDir * 7.0 + warp * 1.8 + uTime * 0.25);
  float filaments = smoothstep(0.52, 0.66, fil) * (1.0 - smoothstep(0.66, 0.82, fil));

  // whole-surface equalizer: FFT patches scattered everywhere, plus a global pulse
  float band = noise(vDir * 3.0);
  float samp = texture2D(uSpectrum, vec2(band, 0.5)).r * uAudio;

  float hot = clamp(vDisp / 10.0, 0.0, 1.0);
  vec3 col = mix(vec3(0.0, 0.30, 0.88), vec3(0.45, 0.78, 1.0), gran);
  col *= 0.6 + gran * 0.6;
  col = mix(col, vec3(0.0, 0.10, 0.42), spot * 0.7);          // sunspots darken
  col += vec3(0.55, 0.88, 1.0) * filaments * 1.0;             // liquid plasma streams
  col += vec3(0.2, 0.55, 1.0)  * fres * 1.0;                  // limb / corona rim
  col += vec3(0.5, 0.85, 1.0)  * hot * 0.6;
  col += vec3(0.6, 0.95, 1.0)  * samp * (0.5 + uLevel) * 1.5; // equalizer over the whole sphere
  col *= uOpacity * 0.38;                                     // dimmer overall — was blowing out the scene
  gl_FragColor = vec4(col, 1.0);
}
`

/* corona — plasma streamers reaching off the limb, flowing outward */
const coronaFrag = /* glsl */`
uniform float uOpacity, uTime;
varying vec3 vN;
varying vec3 vView;
varying vec3 vDir;
${noiseGlsl}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  float rim = pow(1.0 - abs(dot(n, v)), 2.4);
  // filaments streaming away from the core (noise advected radially outward)
  float s = fbm(vDir * 5.0 - vec3(0.0, 0.0, uTime * 0.5) + fbm(vDir * 2.0 + uTime * 0.2));
  float streak = smoothstep(0.48, 0.7, s);
  vec3 col = vec3(0.14, 0.45, 1.0) * rim * (0.5 + streak * 1.8);
  gl_FragColor = vec4(col * 0.55, rim * uOpacity * (0.4 + streak * 0.7) * 0.6);
}
`
const coronaVert = /* glsl */`
varying vec3 vN;
varying vec3 vView;
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vN = normalMatrix * normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

/* ───────────────────────────  CABLES  ─────────────────────────── */
const cableVert = /* glsl */`
attribute float aT;
attribute float aPhase;
varying float vT;
varying float vPhase;
void main() {
  vT = aT; vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const cableFrag = /* glsl */`
uniform float uTime, uOpacity, uAudio;
varying float vT;
varying float vPhase;
void main() {
  float flow = fract(vT - uTime * 0.35 + vPhase);
  // running "energy" pulses only travel up the cables while music plays
  float head = (pow(1.0 - flow, 8.0) + pow(1.0 - fract(flow + 0.5), 8.0) * 0.4) * uAudio;
  vec3  col  = mix(vec3(0.0, 0.18, 0.5), vec3(0.6, 0.95, 1.0), head);
  float a    = uOpacity * (0.05 + head * 1.2);            // faint dormant strands when silent
  gl_FragColor = vec4(col, a);
}
`

export default function NeutronCore() {
  const root      = useRef<THREE.Group>(null)
  const coreMat   = useRef<THREE.ShaderMaterial>(null)
  const coronaMat = useRef<THREE.ShaderMaterial>(null)
  const cableMat  = useRef<THREE.ShaderMaterial>(null)
  const lights    = useRef<THREE.Group>(null)
  const smooth    = useRef(0)
  const gate      = useRef(0)   // 0..1 audio on/off, eased for soft transitions
  const lvl       = useRef(0)   // smoothed loudness (fast-attack, slow-release)

  const freq = useMemo(() => new Uint8Array(64), [])
  const spectrum = useMemo(() => {
    const tex = new THREE.DataTexture(freq, freq.length, 1, THREE.RedFormat, THREE.UnsignedByteType)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [freq])

  const coreGeo   = useMemo(() => new THREE.IcosahedronGeometry(RADIUS, LOW ? 5 : 12), [])
  const coronaGeo = useMemo(() => new THREE.IcosahedronGeometry(RADIUS * 1.22, 3), [])

  const coreUniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uAudio: { value: 0 },
    uLevel: { value: 0 }, uSpectrum: { value: spectrum },
  }), [spectrum])
  const coronaUniforms = useMemo(() => ({ uOpacity: { value: 0 }, uTime: { value: 0 } }), [])
  const cableUniforms  = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uAudio: { value: 0 } }), [])

  // Cables: gentle béziers from the core's upper hemisphere up to the city base.
  const cableGeo = useMemo(() => {
    const cityLocalY = CITY_Y - CORE_Y
    const SEG = 16
    const pos: number[] = [], ts: number[] = [], phs: number[] = []
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const prev = new THREE.Vector3(), cur = new THREE.Vector3()
    for (let i = 0; i < NCABLES; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(0.15 + Math.random() * 0.85)
      a.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).multiplyScalar(RADIUS)
      b.set((Math.random() - 0.5) * 220, cityLocalY, -40 + (Math.random() - 0.5) * 200)
      c.set((a.x + b.x) * 0.5 + (Math.random() - 0.5) * 90, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5 + (Math.random() - 0.5) * 90)
      const phase = Math.random()
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG, it = 1 - t
        cur.set(
          it * it * a.x + 2 * it * t * c.x + t * t * b.x,
          it * it * a.y + 2 * it * t * c.y + t * t * b.y,
          it * it * a.z + 2 * it * t * c.z + t * t * b.z,
        )
        if (s > 0) {
          pos.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z)
          ts.push((s - 1) / SEG, t)
          phs.push(phase, phase)
        }
        prev.copy(cur)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phs, 1))
    return g
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollState.progress
    const op = Math.min(1, Math.max(0, (p - 0.78) / 0.14))
    smooth.current += (op - smooth.current) * 0.06
    const o = smooth.current

    // Skip the entire (very expensive) core — heavy shaders + glass transmission
    // pass — whenever it isn't on screen. Saves all of it on the hero/city scroll.
    if (root.current) root.current.visible = o > 0.004
    if (o <= 0.004) return

    const an = audioState.analyser
    const playing = audioState.playing && !!an
    // soft on/off envelope so nothing snaps when music toggles
    gate.current += ((playing ? 1 : 0) - gate.current) * 0.05
    let level = 0
    if (playing) {
      an!.getByteFrequencyData(freq)
      spectrum.needsUpdate = true
      let s = 0
      for (let i = 0; i < 14; i++) s += freq[i]
      level = s / (14 * 255)
    }
    // fast attack, slow release — fades out gently when the music stops
    const target = level * gate.current
    lvl.current += (target - lvl.current) * (target > lvl.current ? 0.5 : 0.06)

    if (coreMat.current) {
      coreMat.current.uniforms.uTime.value = t
      coreMat.current.uniforms.uOpacity.value = o
      coreMat.current.uniforms.uAudio.value = gate.current
      coreMat.current.uniforms.uLevel.value = lvl.current
    }
    if (coronaMat.current) {
      coronaMat.current.uniforms.uOpacity.value = o
      coronaMat.current.uniforms.uTime.value = t
    }
    if (cableMat.current) {
      cableMat.current.uniforms.uTime.value = t
      cableMat.current.uniforms.uOpacity.value = o
      cableMat.current.uniforms.uAudio.value = gate.current   // energy only flows with the music
    }

    if (lights.current)
      lights.current.children.forEach((c) => {
        ;(c as THREE.PointLight).intensity = o * (1.3 + lvl.current * 3.5)
      })
  })

  return (
    <group ref={root} position={[0, CORE_Y, CITY_Z]} visible={false}>
      <group ref={lights}>
        <pointLight color="#1a6bff" position={[0, 0, 120]} distance={500} decay={1.3} intensity={0} />
        <pointLight color="#39b6ff" position={[140, 60, -40]} distance={500} decay={1.3} intensity={0} />
        <pointLight color="#7a5cff" position={[-140, -40, -40]} distance={500} decay={1.3} intensity={0} />
      </group>

      <mesh geometry={coreGeo} frustumCulled={false}>
        <shaderMaterial ref={coreMat} vertexShader={coreVert} fragmentShader={coreFrag} uniforms={coreUniforms} />
      </mesh>

      <mesh geometry={coronaGeo} frustumCulled={false}>
        <shaderMaterial
          ref={coronaMat}
          vertexShader={coronaVert}
          fragmentShader={coronaFrag}
          uniforms={coronaUniforms}
          transparent side={THREE.BackSide} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <lineSegments geometry={cableGeo} frustumCulled={false}>
        <shaderMaterial
          ref={cableMat}
          vertexShader={cableVert}
          fragmentShader={cableFrag}
          uniforms={cableUniforms}
          transparent depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  )
}
