'use client'
import { useEffect, useState } from 'react'
import { PHONE } from './quality'

// Reactive phone check — re-evaluated on resize / orientation so the hero's
// hover behaviour switches live when the viewport crosses the phone breakpoint
// (e.g. responsive devtools), instead of being frozen at the initial userAgent.
export function useIsPhone() {
  const [phone, setPhone] = useState(PHONE)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)')
    const update = () => setPhone(mq.matches || PHONE)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}
