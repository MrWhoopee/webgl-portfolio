'use client'
import { useState, useEffect, useRef } from 'react'
import { useLenis } from 'lenis/react'

const CHARS = '!<>-_\\/[]{}=+*^?#@%$~|'

// DOM-based scramble: no setState in the animation loop
function NavItem({ label, scramble, onClick }: {
  label: string; scramble: boolean; onClick: () => void
}) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = spanRef.current
    if (!el) return

    if (!scramble) { el.textContent = label; return }

    const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)]

    // Start fully scrambled
    el.textContent = label.split('').map(c => (c === ' ' ? ' ' : rand())).join('')

    let frame = 0
    const total = 24
    const id = setInterval(() => {
      el.textContent = label.split('').map((char, i) => {
        if (char === ' ') return ' '
        return frame / total > i / label.length ? char : rand()
      }).join('')
      if (++frame > total) { clearInterval(id); el.textContent = label }
    }, 35)

    return () => clearInterval(id)
  }, [scramble, label])

  return (
    <button
      onClick={onClick}
      className="group relative text-slate-400 hover:text-white transition-colors duration-200"
      style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.18em', padding: '0.5rem 0.25rem' }}
    >
      <span ref={spanRef}>{label}</span>
      {/* Underline on hover */}
      <span
        className="absolute bottom-0 left-0 w-0 group-hover:w-full h-px transition-all duration-300"
        style={{ background: '#7C3AED' }}
      />
    </button>
  )
}

const NAV = [
  { label: 'About',   href: '#about' },
  { label: 'Skills',  href: '#skills' },
  { label: 'Contact', href: '#contact' },
]

const TICKS = [
  '> initializing portfolio.config.ts',
  '> compiling components...',
  '> ready ✓',
]

export default function Navbar() {
  const lenis       = useLenis()
  const [visible,   setVisible]  = useState(true)
  const [scramble,  setScramble] = useState(false)
  const [codeLine,  setCodeLine] = useState('')
  const visibleRef  = useRef(true)
  const lastScrollY = useRef(0)

  function show() {
    if (visibleRef.current) return
    visibleRef.current = true
    setVisible(true)
    // Scramble + code ticker
    setScramble(true)
    TICKS.forEach((line, i) => setTimeout(() => setCodeLine(line), i * 180))
    setTimeout(() => { setScramble(false); setCodeLine('') }, 700)
  }

  function hide() {
    if (!visibleRef.current) return
    visibleRef.current = false
    setVisible(false)
  }

  useLenis(({ scroll }) => {
    const delta = scroll - lastScrollY.current
    lastScrollY.current = scroll
    if (scroll < 20) { if (!visibleRef.current) show(); return }
    if (delta > 4)   hide()
    else if (delta < -3) show()
  })

  function scrollTo(href: string) {
    lenis?.scrollTo(href, { duration: 1.6 })
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex flex-col transition-all duration-500"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Code ticker */}
      {codeLine && (
        <div
          className="w-full px-10 py-1 text-xs"
          style={{
            paddingLeft: '3px',
            fontFamily: 'Space Mono, monospace',
            color: '#7C3AED',
            background: 'rgba(8,0,16,0.7)',
            borderBottom: '1px solid rgba(124,58,237,0.25)',
          }}
        >
          {codeLine}
        </div>
      )}

      {/* Nav bar */}
      <div
        className="relative flex items-center px-10 md:px-20 py-5"
        style={{ paddingLeft: '3px', background: 'rgba(8,0,16,0.50)', backdropFilter: 'blur(14px)' }}
      >
        {/* Logo */}
        <div style={{ width: '60px' }}>
          <button
            onClick={() => lenis?.scrollTo(0)}
            className="text-white font-bold tracking-widest text-base"
            style={{ fontFamily: 'Space Mono, monospace' }}
          >
            A<span style={{ color: '#7C3AED' }}>.</span>
          </button>
        </div>

        {/* Centered nav items */}
        <div className="flex-1 flex justify-center items-center gap-12">
          {NAV.map(({ label, href }) => (
            <NavItem
              key={label}
              label={label}
              scramble={scramble}
              onClick={() => scrollTo(href)}
            />
          ))}
        </div>

        {/* Balance spacer */}
        <div style={{ width: '60px' }} />
      </div>
    </nav>
  )
}
