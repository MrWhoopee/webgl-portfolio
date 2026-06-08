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
import { onScroll } from '@/lib/scroll'
import { LOW, DPR } from '@/lib/quality'

export default function Scene() {
  // While the hero (its own canvas) fully covers this one, freeze the loop — no
  // point running a second bloom pipeline behind it. Resume just before the hero
  // fades (hero stays active until 0.28) so there's a brief overlap, never a gap.
  const [active, setActive] = useState(false)
  useEffect(() => onScroll((p) => setActive(p > 0.22)), [])

  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 18, 35], fov: 65, near: 0.1, far: 900 }}
        gl={{ antialias: !LOW, powerPreference: 'high-performance' }}
        dpr={DPR}
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
