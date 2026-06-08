'use client'
import dynamic from 'next/dynamic'
import { useEggPhase } from '@/lib/egg'

const Scene = dynamic(() => import('./Scene'), { ssr: false })

export default function SceneLoader() {
  const phase = useEggPhase()
  // Once we warp out, the main scene is gone for good (until reload).
  if (phase === 'warp' || phase === 'galaxy') return null
  return <Scene />
}
