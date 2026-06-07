'use client'
import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '@/lib/scroll'

// ── Code lines ────────────────────────────────────────────────────────────────

const CODE = [
  `import { useFrame } from '@react-three/fiber'`,
  `import { createNoise2D } from 'simplex-noise'`,
  ``,
  `const noise2D = createNoise2D()`,
  ``,
  `function Terrain() {`,
  `  const mat = useRef<THREE.ShaderMaterial>(null)`,
  `  const uniforms = useMemo(() => ({`,
  `    uTime:  { value: 0 },`,
  `    uMouse: { value: new Vector2() },`,
  `    uOpacity: { value: 1 },`,
  `  }), [])`,
  ``,
  `  useFrame(({ clock }) => {`,
  `    const t = clock.getElapsedTime()`,
  `    mat.current!.uniforms.uTime.value = t`,
  `  })`,
  ``,
  `  return <shaderMaterial ref={mat}`,
  `    uniforms={uniforms}`,
  `    vertexShader={vert}`,
  `    fragmentShader={frag} />`,
  `}`,
  ``,
  `// GLSL — vertex`,
  `uniform float uTime;`,
  `uniform vec2  uMouse;`,
  `varying vec2  vUv;`,
  `varying float vHeight;`,
  ``,
  `void main() {`,
  `  vec3 pos = position;`,
  `  float d  = distance(uv, uMouse);`,
  `  float w  = sin(d * 13.0 - uTime * 4.5)`,
  `           * exp(-d * 6.5) * 4.0;`,
  `  pos.y   += w;`,
  `  vHeight  = pos.y;`,
  `  gl_Position = projectionMatrix`,
  `    * modelViewMatrix * vec4(pos, 1.0);`,
  `}`,
  ``,
  `// GLSL — fragment`,
  `void main() {`,
  `  float t = clamp(vHeight / 30.0, 0.0, 1.0);`,
  `  vec3 base = vec3(0.04, 0.01, 0.13);`,
  `  vec3 peak = vec3(0.84, 0.22, 0.74);`,
  `  vec3 col  = mix(base, peak, t);`,
  `  gl_FragColor = vec4(col, uOpacity);`,
  `}`,
  ``,
  `> compiling shaders...      OK`,
  `> uploading geometry:  28800 verts`,
  `> postprocessing:   bloom + CA`,
  `> lenis scroll →   camera rig`,
  `> particles:    180 pool ready`,
  `> renderer:         60fps target`,
  `> status:               ready ✓`,
  ``,
]

// ── Shaders ──────────────────────────────────────────────────────────────────

const vert = /* glsl */`
uniform float uTime;
varying vec2  vUv;
varying float vWave;
void main() {
  vec3 pos = position;
  float wave = sin(pos.x * 0.28 + uTime * 1.6) * 0.7
             + sin(pos.y * 0.35 + uTime * 1.2) * 0.5;
  pos.z += wave;
  vWave = wave; vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const frag = /* glsl */`
uniform sampler2D uCodeTex;
uniform float     uOpacity;
varying vec2      vUv;
varying float     vWave;
void main() {
  vec3 code    = texture2D(uCodeTex, vUv).rgb;
  float edge   = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float glow   = 1.0 - smoothstep(0.0, 0.055, edge);
  vec3 edgeCol = mix(vec3(0.48, 0.10, 0.92), vec3(0.92, 0.22, 0.62), vUv.y);
  vec3 color   = mix(vec3(0.03, 0.0, 0.09), code * 1.1, 0.9);
  color = mix(color, edgeCol, glow * 1.8);
  color *= 1.0 + abs(vWave) * 0.14;
  gl_FragColor = vec4(color, uOpacity * 0.90);
}
`

// ── Wall layout ───────────────────────────────────────────────────────────────

const WALLS = [
  { pos: [-44,  4, -32] as const, rot: [0,  0.58,  0.16] as const, w: 22, h: 32 },
  { pos: [ 44,  4, -32] as const, rot: [0, -0.58, -0.10] as const, w: 22, h: 32 },
  { pos: [-28, 10, -70] as const, rot: [0,  0.75,  0.08] as const, w: 28, h: 40 },
  { pos: [ 28,  2, -70] as const, rot: [0, -0.75, -0.08] as const, w: 28, h: 40 },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function SectionWalls() {
  const matsRef  = useRef<(THREE.ShaderMaterial | null)[]>([null, null, null, null])
  const canvasRef= useRef<HTMLCanvasElement | null>(null)
  const texRef   = useRef<THREE.CanvasTexture | null>(null)
  const smoothOp = useRef(0)

  const uniforms = useMemo(() =>
    WALLS.map(() => ({
      uTime:    { value: 0 },
      uOpacity: { value: 0 },
      uCodeTex: { value: null as THREE.CanvasTexture | null },
    })),
  [])

  useEffect(() => {
    const cvs = document.createElement('canvas')
    cvs.width = 1024; cvs.height = 512
    canvasRef.current = cvs
    const tex = new THREE.CanvasTexture(cvs)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    texRef.current = tex
    uniforms.forEach(u => { u.uCodeTex.value = tex })
    return () => { tex.dispose() }
  }, [uniforms])

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime()
    const p  = scrollState.progress

    // Section opacity: fade in 0.22–0.38
    const opTarget = p < 0.22 ? 0 : Math.min(1, (p - 0.22) / 0.16)
    smoothOp.current += (opTarget - smoothOp.current) * 0.06

    // Draw code canvas
    const cvs = canvasRef.current
    const tex = texRef.current
    if (cvs && tex) {
      const ctx = cvs.getContext('2d')!
      const lh  = 18
      ctx.fillStyle = '#03000a'
      ctx.fillRect(0, 0, 1024, 512)
      ctx.font = '12.5px "Space Mono", monospace'
      ctx.textBaseline = 'top'

      const scroll = t * 6
      const offset = scroll % 1
      const vis    = Math.ceil(512 / lh) + 2

      for (let i = 0; i < vis; i++) {
        const idx  = (Math.floor(scroll) + i) % CODE.length
        const line = CODE[idx]
        const y    = i * lh - offset * lh
        if (!line) continue
        ctx.fillStyle =
          line.startsWith('//') || line.startsWith('>') ? '#5b21b6' :
          /^(import|const|function|uniform|varying|void)/.test(line)  ? '#a855f7' :
          line.includes('=>') || line.includes('return')              ? '#ec4899' :
          '#7c3aed'
        ctx.fillText(line, 14, y)
      }
      tex.needsUpdate = true
    }

    // Sync uniforms
    matsRef.current.forEach((m, i) => {
      if (!m) return
      m.uniforms.uTime.value    = t
      m.uniforms.uOpacity.value = smoothOp.current
      m.uniforms.uCodeTex.value = texRef.current
    })
  })

  return (
    <group>
      {WALLS.map((w, i) => (
        <mesh key={i} position={[...w.pos] as [number,number,number]} rotation={[...w.rot] as [number,number,number]}>
          <planeGeometry args={[w.w, w.h, 20, 28]} />
          <shaderMaterial
            ref={(m) => { matsRef.current[i] = m }}
            vertexShader={vert}
            fragmentShader={frag}
            uniforms={uniforms[i]}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
