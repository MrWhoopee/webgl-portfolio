'use client'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'
import SectionPlanes from './SectionPlanes'
import CyberCity from './CyberCity'
import NeutronCore from './NeutronCore'
import CameraRig from './CameraRig'

export default function Scene() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 18, 35], fov: 65, near: 0.1, far: 900 }}
        gl={{ antialias: true }}
        style={{ background: '#060112' }}
      >
        {/* Only fog-enabled materials (the GLB city) breathe this haze; the
            custom-shader scenes and the fog={false} core room ignore it. */}
        <fog attach="fog" args={['#060112', 80, 360]} />
        <ambientLight intensity={0.03} />

        {/* Vertical descent (hero lives in its own canvas, SynthwaveHero):
            pink planes → cyberpunk city → neutron core. */}
        <SectionPlanes />
        <CyberCity />
        <NeutronCore />

        <CameraRig />

        <EffectComposer>
          <Bloom intensity={1.7} luminanceThreshold={0.05} luminanceSmoothing={0.9} mipmapBlur />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new Vector2(0.0012, 0.0012)} />
          <Vignette offset={0.38} darkness={0.80} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
