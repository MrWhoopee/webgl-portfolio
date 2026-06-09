'use client'
import { useEffect, useRef } from 'react'

/* Reveals text with a "decoding" scramble — starts as random glyphs and resolves
   left-to-right the first time it scrolls into view. DOM-driven (no setState in
   the loop). SSR renders the real text, so it stays crawlable / works without JS. */
const CHARS = '!<>-_\\/[]{}=+*^?#@%$~|01'

type Props = {
  text: string
  as?: React.ElementType
  className?: string
  style?: React.CSSProperties
  delay?: number
}

export default function DecodeText({ text, as: Tag = 'span', className, style, delay = 0 }: Props) {
  const ref = useRef<HTMLElement>(null)
  const fxRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = ref.current
    const el = fxRef.current
    if (!root || !el) return
    const rand = () => CHARS[(Math.random() * CHARS.length) | 0]
    const scrambled = () => text.split('').map((c) => (c === ' ' ? ' ' : rand())).join('')
    el.textContent = scrambled()

    let interval: ReturnType<typeof setInterval> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      if (interval) clearInterval(interval)
      const total = Math.min(64, Math.max(18, Math.round(text.length * 0.6)))
      let frame = 0
      interval = setInterval(() => {
        el.textContent = text.split('').map((c, i) =>
          c === ' ' ? ' ' : frame / total > i / text.length ? c : rand()
        ).join('')
        if (++frame > total) { clearInterval(interval); interval = undefined; el.textContent = text }
      }, 30)
    }

    // Re-decode every time the element scrolls into view; reset to scramble on exit.
    const io = new IntersectionObserver((entries) => {
      if (timer) clearTimeout(timer)
      if (entries[0].isIntersecting) {
        timer = setTimeout(run, delay)
      } else {
        if (interval) { clearInterval(interval); interval = undefined }
        el.textContent = scrambled()
      }
    }, { threshold: 0.25 })
    io.observe(root)

    return () => { io.disconnect(); if (interval) clearInterval(interval); if (timer) clearTimeout(timer) }
  }, [text, delay])

  const Comp = Tag as React.ComponentType<{
    ref?: React.Ref<HTMLElement>
    className?: string
    style?: React.CSSProperties
    children?: React.ReactNode
  }>
  // Real text (invisible) reserves the final width so the scramble overlay can
  // never reflow the layout on narrow/mobile containers.
  return (
    <Comp
      ref={ref}
      className={className}
      style={{ position: 'relative', display: Tag === 'span' ? 'inline-block' : undefined, ...style }}
    >
      <span style={{ visibility: 'hidden' }}>{text}</span>
      <span ref={fxRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
    </Comp>
  )
}
