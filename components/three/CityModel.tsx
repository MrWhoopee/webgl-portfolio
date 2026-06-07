'use client'
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/* Drop your exported Meshy city here: public/models/city.glb
   (https://www.meshy.ai/s/xkjC3o → Export → GLB). Until then the procedural
   skyline is shown as a fallback via <ErrorBoundary>. */
const URL = '/models/city.glb'

// Fit + placement tweakables (world units, relative to the CyberCity group).
const TARGET_HEIGHT = 135   // tallest spire reaches ~world y -15 → pokes the hole
const OFFSET_X = 0
const OFFSET_Z = 0

export default function CityModel() {
  const { scene } = useGLTF(URL)

  const model = useMemo(() => {
    const s = scene.clone(true)
    const box = new THREE.Box3().setFromObject(s)
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const k = TARGET_HEIGHT / size.y
    s.scale.setScalar(k)
    s.position.set(-center.x * k + OFFSET_X, -box.min.y * k, -center.z * k + OFFSET_Z)
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.frustumCulled = false
        const mat = m.material as THREE.MeshStandardMaterial
        if (mat && 'emissive' in mat) {
          mat.fog = true
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.35)
        }
      }
    })
    return s
  }, [scene])

  return <primitive object={model} />
}
