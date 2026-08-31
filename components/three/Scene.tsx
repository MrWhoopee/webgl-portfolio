'use client'
import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'
import SectionPlanes from './SectionPlanes'
import CyberCity from './CyberCity'
import NeutronCore from './NeutronCore'
import CameraRig from './CameraRig'
import { LOW } from '@/lib/quality'
import { useBudgetDpr } from '@/lib/useBudgetDpr'
import { onScroll } from '@/lib/scroll'
import { useInteractionPaused } from '@/lib/interaction'

export default function Scene() {
  // Pause the render loop while the browser is being resized/zoomed so the GPU is
  // free for the compositor to scale the canvas smoothly instead of stuttering.
  const paused = useInteractionPaused()
  const dpr = useBudgetDpr()
  // The opaque hero canvas fully covers this background scene at the very top, so
  // rendering both means two full-screen postprocessing pipelines at once — that's
  // what pins the top of the page to ~30fps (and makes zooming there stutter).
  // Freeze this scene until the hero starts scrolling away; the small overlap
  // window keeps its content ready before the hero uncovers it.
  const [visible, setVisible] = useState(false)
  useEffect(() => onScroll((p) => setVisible(p > 0.15)), [])
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        frameloop={visible && !paused ? 'always' : 'never'}
        camera={{ position: [0, 18, 35], fov: 65, near: 0.1, far: 900 }}
        gl={{ antialias: !LOW, powerPreference: 'high-performance' }}
        // While hidden, render at a tiny dpr so the offscreen buffer can't balloon
        // when the layout viewport grows on zoom-out; jump to the budget dpr once
        // it's actually shown.
        dpr={visible ? dpr : 0.3}
        style={{ background: '#060112' }}
      >

        {/* No scene fog — atmosphere comes only from the custom GroundFog layers. */}
        <ambientLight intensity={0.03} />

        {/* Vertical descent (hero lives in its own canvas, SynthwaveHero):
            pink planes → cyberpunk city → neutron core. */}
        <SectionPlanes />
        <CyberCity />
        <NeutronCore />

        <CameraRig />

        {/* Postprocessing scaled to the device: phones keep just bloom (the
            scene's signature glow), desktops add chromatic aberration + vignette. */}
        {LOW ? (
          <EffectComposer multisampling={0}>
            <Bloom intensity={1.2} luminanceThreshold={0.05} luminanceSmoothing={0.9} mipmapBlur />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={4}>
            <Bloom intensity={1.7} luminanceThreshold={0.05} luminanceSmoothing={0.9} mipmapBlur />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new Vector2(0.0012, 0.0012)} />
            <Vignette offset={0.38} darkness={0.80} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
