'use client'
import { useEffect, useRef, useState } from 'react'
import { useLenis } from 'lenis/react'
import { isLocked, useEggPhase } from '@/lib/egg'

const ALL_LINES = [
  '$ npm run dev',
  '▲ Next.js 16 (Turbopack)',
  '  Local: http://localhost:3000',
  '',
  "import { Canvas } from '@react-three/fiber'",
  "import { createNoise2D } from 'simplex-noise'",
  '',
  'const noise2D = createNoise2D()',
  '',
  'function Terrain() {',
  '  const geo = useMemo(() => {',
  '    const g = new PlaneGeometry(',
  '      460, 230, 90, 50',
  '    )',
  '    g.rotateX(-Math.PI / 2)',
  '    for (let i = 0; i < pos.count; i++) {',
  '      let y  = noise2D(x * 0.010, z * 0.010) * 28',
  '          y += noise2D(x * 0.026, z * 0.026) * 11',
  '      pos.setY(i, Math.max(0, y))',
  '    }',
  '    return g',
  '  }, [])',
  '}',
  '',
  '// vertex.glsl',
  'uniform vec2  uMouse;',
  'uniform float uTime;',
  'varying float vHeight;',
  '',
  'void main() {',
  '  float d = distance(uv, uMouse);',
  '  float r = sin(d * 10.0 - uTime * 5.0)',
  '          * exp(-d * 4.0) * 12.0;',
  '  pos.y  += r;',
  '  vHeight = pos.y;',
  '  gl_Position = projectionMatrix',
  '    * modelViewMatrix * vec4(pos, 1.0);',
  '}',
  '',
  '// fragment.glsl',
  'void main() {',
  '  float t = clamp(vHeight / 30.0, 0.0, 1.0);',
  '  vec3 c0 = vec3(0.36, 0.08, 0.88);',
  '  vec3 c1 = vec3(0.88, 0.12, 0.65);',
  '  vec3 col = mix(c0, c1, t);',
  '  gl_FragColor = vec4(col, uOpacity);',
  '}',
  '',
  '// Lenis scroll → camera',
  "lenis.on('scroll', ({ progress }) => {",
  '  scrollState.progress = progress',
  '})',
  '',
  '> shaders compiled  ✓',
  '> geometry: 9000 tri ✓',
  '> bloom: enabled     ✓',
  '> fps: 60            ✓',
  '',
]

function lineColor(line: string): string {
  if (!line.trim()) return 'transparent'
  if (line.startsWith('$') || line.startsWith('▲') || line.startsWith('>')) return '#a855f7'
  if (line.trim().startsWith('//')) return '#5b21b6'
  if (/^(import|const|function|void|uniform|varying|return|let)/.test(line.trim())) return '#ec4899'
  if (line.includes('✓')) return '#a855f7'
  return '#7c3aed'
}

export default function TerminalCode() {
  const [visible, setVisible] = useState(false)
  const [lines,   setLines]   = useState(() => ALL_LINES.slice(0, 22))
  const idxRef   = useRef(22)
  const eggPhase = useEggPhase()

  useLenis(({ progress }) => { setVisible(progress > 0.24) })

  useEffect(() => {
    const id = setInterval(() => {
      const next = ALL_LINES[idxRef.current % ALL_LINES.length]
      idxRef.current++
      setLines(prev => {
        const updated = [...prev, next]
        return updated.length > 32 ? updated.slice(-32) : updated
      })
    }, 260)
    return () => clearInterval(id)
  }, [])

  if (isLocked(eggPhase)) return null

  return (
    <div
      className="hidden xl:block"
      style={{
        position: 'fixed',
        right: '2.5rem',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '27rem',
        maxHeight: '70vh',
        overflow: 'hidden',
        opacity: visible ? 0.82 : 0,
        transition: 'opacity 0.7s ease',
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: '"Space Mono", monospace',
        fontSize: '0.69rem',
        lineHeight: '1.65',
        color: '#7c3aed',
        padding: '1.4rem 1.6rem',
        background: 'rgba(8,0,16,0.30)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(124,58,237,0.20)',
        borderRadius: '0',
      }}
    >
      {/* CRT scanlines overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg,rgba(0,0,0,0.05) 0,rgba(0,0,0,0.05) 1px,transparent 1px,transparent 2px)',
      }} />

      <div style={{ position: 'relative', zIndex: 2 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: lineColor(line), whiteSpace: 'pre', minHeight: '1.1em' }}>
            {line || ' '}
          </div>
        ))}
        <span style={{ color: '#7C3AED' }}>
          ▋
        </span>
      </div>

      <style>{`
        @keyframes cur { 0%,100%{opacity:1} 50%{opacity:0} }
        span[data-cursor] { animation: cur 0.8s step-end infinite }
      `}</style>
    </div>
  )
}
