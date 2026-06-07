'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { scrollState } from '@/lib/scroll'

/* Keyframed vertical descent: pink planes → cyberpunk city → neutron core.
   [scroll progress, camera Y] — interpolated linearly between stops. */
const KEYS: [number, number][] = [
  [0.12,   60],   // top of the pink corridor — upper plane reads as hero's floor
  [0.306, -52],   // about — exactly midway between the two far-apart planes
  [0.50, -150],   // diving through the lower plane past the tearing towers
  [0.653,-232],   // skills — exactly amid the city (between plane and ground)
  [0.82, -370],   // descending toward the core chamber
  [1.0,  -470],   // contact — inside the core chamber
]

function camY(p: number) {
  if (p <= KEYS[0][0]) return KEYS[0][1]
  for (let i = 1; i < KEYS.length; i++) {
    if (p <= KEYS[i][0]) {
      const [p0, y0] = KEYS[i - 1]
      const [p1, y1] = KEYS[i]
      return y0 + (y1 - y0) * (p - p0) / (p1 - p0)
    }
  }
  return KEYS[KEYS.length - 1][1]
}

export default function CameraRig() {
  const { camera, pointer } = useThree()

  useFrame(() => {
    const y = camY(scrollState.progress)

    // Smooth X parallax only — no Y tilt (causes unwanted oscillation)
    camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.06
    camera.position.y = y
    camera.position.z = 35

    camera.lookAt(pointer.x * 0.4, y - 9, -30)
  })

  return null
}
