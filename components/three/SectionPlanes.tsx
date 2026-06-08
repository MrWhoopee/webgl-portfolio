'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'
import { audioState } from '@/lib/audio'
import { cityState } from '@/lib/cityState'
import { LOW, MOBILE } from '@/lib/quality'
import { TILT, UPPER_Y, LOWER_Y, PLANE_Z, CITY_HOLES } from '@/lib/cityLayout'

const NHOLES = CITY_HOLES.length   // one tear per hero tower, punched to match it

/* Crisp anti-aliased grid drawn in the fragment shader (fwidth), so lines stay
   sharp at any distance instead of dissolving like a wireframe under bloom. */
const gridGlsl = /* glsl */`
float gridLine(vec2 p, float scale) {
  vec2 g = p * scale;
  vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  return 1.0 - min(min(d.x, d.y), 1.0);   // 1 on a line, 0 between
}
`

/* ─────────────────────────  UPPER PLANE  ───────────────────────── */
const upperVert = /* glsl */`
uniform float uTime;
uniform float uAudio;
uniform float uLevel;
uniform sampler2D uSpectrum;
varying vec2  vGrid;
varying float vHeight;
varying float vFog;

void main() {
  vec3 pos = position;
  vGrid = position.xz;

  float w  = pow(abs(sin(pos.x * 0.25 + uTime * 1.4)),  3.5) * 2.6;
       w  += pow(abs(sin(pos.x * 0.42 + uTime * 0.85)), 3.2) * 1.4;
       w  += pow(abs(sin(pos.z * 0.13 + uTime * 0.70)), 3.0) * 0.9;

  if (uAudio > 0.5) {
    float band = fract(pos.x * 0.011 + pos.z * 0.017);
    float samp = texture2D(uSpectrum, vec2(band, 0.5)).r;
    w *= 1.0 + uLevel * 0.8 + samp * 0.8;
    vec2  id    = floor(vec2(pos.x, pos.z) * 0.5);
    float rnd   = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
    w += step(0.62, fract(rnd * 7.0 + uTime * 9.0)) * (0.4 + samp * 1.6) * rnd;
    w += sin(pos.x * 0.5 + pos.z * 0.3 + uTime * 9.0 + rnd * 6.28) * uLevel * 0.6;
  }

  pos.y  += w;
  vHeight = pos.y;

  float farFade  = clamp((-pos.z - 170.0) / 40.0, 0.0, 1.0);
  float nearFade = clamp((pos.z - 170.0) / 40.0, 0.0, 1.0);
  vFog = max(farFade, nearFade);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const upperFrag = /* glsl */`
uniform float uOpacity;
uniform float uLevel;
varying vec2  vGrid;
varying float vHeight;
varying float vFog;
${gridGlsl}
void main() {
  float line = gridLine(vGrid, 0.5);
  if (line < 0.02) discard;

  float t = clamp(vHeight / 6.0, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.10, 0.80), vec3(1.0, 0.30, 0.55), t);
  col += vec3(1.0, 0.10, 0.55) * (0.6 + t * 1.6);

  float flare = smoothstep(0.8, 1.0, t) * smoothstep(0.55, 1.0, uLevel);
  col += vec3(0.4, 0.9, 1.0) * flare * 0.7;

  col *= 0.5;                                 // tone down — was searing the eyes
  float alpha = uOpacity * line * (1.0 - vFog);
  gl_FragColor = vec4(col, alpha);
}
`

/* ─────────────────────────  LOWER PLANE  ─────────────────────────
   Same pink grid, punctured by ~20 holes (uHoles[]). The surface caves into
   each tear and a white neon border burns around it — a hero tower of the city
   below lances up through every gap.                                       */
const lowerVert = /* glsl */`
uniform float uTime;
uniform float uAudio;
uniform float uLevel;
uniform float uTear;               // 0 → solid grid, 1 → towers punched through
uniform sampler2D uSpectrum;
uniform vec3  uHoles[${NHOLES}];   // xy = center (local), z = radius
varying vec2  vGrid;
varying float vHeight;
varying float vFog;
varying float vTear;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 pos = position;
  vGrid = position.xz;

  float w  = pow(abs(sin(pos.x * 0.25 + uTime * 1.4)),  3.5) * 2.6;
       w  += pow(abs(sin(pos.x * 0.42 + uTime * 0.85)), 3.2) * 1.4;
       w  += pow(abs(sin(pos.z * 0.13 + uTime * 0.70)), 3.0) * 0.9;
       w  += sin(pos.x * 0.5 + pos.z * 0.37 + uTime * 1.7) * 0.6;   // unstable churn

  vec2  id  = floor(pos.xz * 0.5);
  float rnd = hash(id);

  if (uAudio > 0.5) {
    float band = fract(pos.x * 0.011 + pos.z * 0.017);
    float samp = texture2D(uSpectrum, vec2(band, 0.5)).r;
    w *= 1.0 + uLevel * 0.8 + samp * 0.8;
    w += step(0.62, fract(rnd * 7.0 + uTime * 9.0)) * (0.4 + samp * 1.6) * rnd;
  }

  float tear = 0.0;
  for (int i = 0; i < ${NHOLES}; i++) {
    float d = distance(pos.xz, uHoles[i].xy);
    tear = max(tear, 1.0 - smoothstep(0.0, uHoles[i].z, d));
  }
  tear *= uTear;                 // gated: no holes until the city has compiled
  vTear = tear;

  float lift = smoothstep(0.30, 0.95, tear);
  w -= tear * 5.0;                                      // the hole caves into the void
  w += lift * (2.5 + 2.0 * sin(uTime * 3.0 + rnd * 6.28)); // rim shards levitate

  pos.y  += w;
  vHeight = pos.y;

  float farFade  = clamp((-pos.z - 170.0) / 40.0, 0.0, 1.0);
  float nearFade = clamp((pos.z - 170.0) / 40.0, 0.0, 1.0);
  vFog = max(farFade, nearFade);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const lowerFrag = /* glsl */`
uniform float uOpacity;
uniform float uLevel;
uniform float uTime;
varying vec2  vGrid;
varying float vHeight;
varying float vFog;
varying float vTear;
${gridGlsl}
void main() {
  if (vTear > 0.80) discard;                 // the punched-through gap

  float line = gridLine(vGrid, 0.5);
  float rim  = smoothstep(0.50, 0.80, vTear);
  if (line < 0.02 && rim < 0.02) discard;

  float t = clamp(vHeight / 6.0, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.10, 0.80), vec3(1.0, 0.30, 0.55), t);
  col += vec3(1.0, 0.10, 0.55) * (0.6 + t * 1.6);

  col = mix(col, vec3(1.0), rim);
  col += vec3(1.0) * rim * (0.6 + uLevel * 1.2);

  col *= 0.55;                                // tone down — was searing the eyes
  float alpha = uOpacity * max(line, rim) * (1.0 - vFog);
  gl_FragColor = vec4(col, alpha);
}
`

/* Levitating polygon shards rise out of each tear where a hero tower punched
   through — little tumbling fragments of the grid, blue and glowing. */
const SHARD_RISE = 18

const UPPER_POS = [0, UPPER_Y, PLANE_Z] as const   // raised — its top reads as the hero's floor
const LOWER_POS = [0, LOWER_Y, PLANE_Z] as const   // 5× the old gap below the upper plane

export default function SectionPlanes() {
  const root     = useRef<THREE.Group>(null)
  const upperMat = useRef<THREE.ShaderMaterial>(null)
  const lowerMat = useRef<THREE.ShaderMaterial>(null)
  const smoothOp = useRef(0)

  // Tears come straight from the city layout, so every hole lines up exactly
  // with the hero tower that breaks through it.
  const holeVecs = useMemo(
    () => CITY_HOLES.map(([x, z, r]) => new THREE.Vector3(x, z, r)), [])

  // Wide planes so the corridor reads broad and the city spreads beneath it.
  // Subdivision halved on low-power devices — the displacement still reads fine.
  const upperGeo = useMemo(() => {
    const s = LOW ? 90 : 150
    const g = new THREE.PlaneGeometry(440, 760, s, s); g.rotateX(-Math.PI / 2); return g
  }, [])
  const lowerGeo = useMemo(() => {
    // Each vertex runs the NHOLES tear loop, so subdivision is the dominant
    // vertex cost — 140 still reads sharp, ~32% lighter than 170.
    const s = LOW ? 90 : 140
    const g = new THREE.PlaneGeometry(440, 760, s, s); g.rotateX(-Math.PI / 2); return g
  }, [])

  const freq = useMemo(() => new Uint8Array(64), [])
  const spectrum = useMemo(() => {
    const tex = new THREE.DataTexture(freq, freq.length, 1, THREE.RedFormat, THREE.UnsignedByteType)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [freq])

  const upperUniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uAudio: { value: 0 },
    uLevel: { value: 0 }, uSpectrum: { value: spectrum },
  }), [spectrum])

  const lowerUniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uAudio: { value: 0 },
    uLevel: { value: 0 }, uTear: { value: 0 }, uSpectrum: { value: spectrum }, uHoles: { value: holeVecs },
  }), [spectrum, holeVecs])

  // Levitating polygon shards (instanced tetrahedra) tumbling up out of each tear.
  const shards    = useRef<THREE.InstancedMesh>(null)
  const shardMat  = useRef<THREE.MeshBasicMaterial>(null)
  const shardGeo  = useMemo(() => new THREE.TetrahedronGeometry(1, 0), [])
  const shardDummy = useMemo(() => new THREE.Object3D(), [])
  const shardData = useMemo(() => {
    if (LOW && !MOBILE) return []   // weak desktops skip them; mobile keeps them
    return CITY_HOLES.flatMap(([hx, hz, r]) =>
      Array.from({ length: MOBILE ? 5 : 8 }, () => {
        const a = Math.random() * Math.PI * 2
        const rr = Math.sqrt(Math.random()) * r * 0.7
        return {
          x: hx + Math.cos(a) * rr,
          z: hz + Math.sin(a) * rr,
          phase: Math.random(),
          speed: 0.10 + Math.random() * 0.14,
          // smaller caps cut additive overdraw through the bloom mip chain
          size: 1.4 + Math.random() * 2.2,
          ax: Math.random() * 2 - 1, ay: Math.random() * 2 - 1, az: Math.random() * 2 - 1,
          spin: 0.5 + Math.random() * 1.6,
        }
      }))
  }, [])

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime()
    const p  = scrollState.progress
    // fade in as the planes scroll into view, fade out before the city takes over
    const fadeIn  = Math.min(1, Math.max(0, (p - 0.14) / 0.10))
    const fadeOut = 1 - Math.min(1, Math.max(0, (p - 0.42) / 0.12))
    const op = Math.min(fadeIn, fadeOut)
    smoothOp.current += (op - smoothOp.current) * 0.055
    const o = smoothOp.current

    // Skip both torn planes when they're off screen (hero above / city below).
    if (root.current) root.current.visible = o > 0.004
    if (o <= 0.004) return

    const an = audioState.analyser
    const playing = audioState.playing && !!an
    let level = 0
    if (playing) {
      an!.getByteFrequencyData(freq)
      spectrum.needsUpdate = true
      let s = 0
      for (let i = 0; i < 12; i++) s += freq[i]
      level = s / (12 * 255)
    }

    for (const m of [upperMat.current, lowerMat.current]) {
      if (!m) continue
      m.uniforms.uTime.value    = t
      m.uniforms.uOpacity.value = o
      m.uniforms.uAudio.value   = playing ? 1 : 0
      const cur = m.uniforms.uLevel.value as number
      m.uniforms.uLevel.value   = level > cur ? level : cur + (level - cur) * 0.18
    }

    // Tears + levitating shards open up at the moment the growing towers visually
    // punch through the plane (mid-compile) — well before the final spires/cars.
    const built = Math.min(1, Math.max(0, (cityState.build - 0.35) / 0.2))
    if (lowerMat.current) lowerMat.current.uniforms.uTear.value = built

    if (shards.current) {
      for (let i = 0; i < shardData.length; i++) {
        const s = shardData[i]
        const tt = (s.phase + t * s.speed) % 1
        // grow in as they rise, shrink out before looping — fades without per-instance alpha
        const fade = Math.min(1, tt / 0.15) * Math.min(1, (1 - tt) / 0.3)
        const sc = s.size * Math.max(0, fade)
        shardDummy.position.set(s.x, tt * SHARD_RISE, s.z)
        shardDummy.rotation.set(t * s.spin * s.ax, t * s.spin * s.ay, t * s.spin * s.az)
        shardDummy.scale.setScalar(sc)
        shardDummy.updateMatrix()
        shards.current.setMatrixAt(i, shardDummy.matrix)
      }
      shards.current.instanceMatrix.needsUpdate = true
    }
    if (shardMat.current) shardMat.current.opacity = o * built
  })

  return (
    <group ref={root} visible={false}>
      {/* Upper plane — keeps its own tilted transform */}
      <mesh geometry={upperGeo} position={UPPER_POS} rotation={[TILT, 0, 0]} frustumCulled={false}>
        <shaderMaterial
          ref={upperMat}
          vertexShader={upperVert}
          fragmentShader={upperFrag}
          uniforms={upperUniforms}
          transparent side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>

      {/* Lower group: the torn grid is punched by tears whose positions are
          derived from the city's hero towers, so each tower pierces its hole. */}
      <group position={LOWER_POS} rotation={[TILT, 0, 0]}>
        <mesh geometry={lowerGeo} frustumCulled={false}>
          <shaderMaterial
            ref={lowerMat}
            vertexShader={lowerVert}
            fragmentShader={lowerFrag}
            uniforms={lowerUniforms}
            transparent side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>

        {/* Levitating polygon shards rising from each tear — hidden only on weak desktops */}
        {(!LOW || MOBILE) && (
          <instancedMesh ref={shards} args={[shardGeo, undefined, shardData.length]} frustumCulled={false}>
            <meshBasicMaterial
              ref={shardMat}
              color="#3aa6ff"
              transparent opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </instancedMesh>
        )}
      </group>
    </group>
  )
}
