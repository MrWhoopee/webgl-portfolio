'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { scrollState } from '@/lib/scroll'
import { eggState } from '@/lib/egg'

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

  useFrame((state) => {
    const p = scrollState.progress
    const y = camY(p)

    // Portrait screens have a narrow horizontal FOV, so the wide core sphere
    // overflows the sides. Pull the camera back as we approach the core chamber
    // (where nothing else is on screen) so the whole core fits the frame.
    const portrait = state.size.height > state.size.width
    const coreNear = Math.min(1, Math.max(0, (p - 0.82) / 0.18))
    const pull = portrait ? 150 * coreNear : 0

    // Smooth X parallax only — no Y tilt (causes unwanted oscillation)
    camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.06
    camera.position.y = y
    camera.position.z = 35 + pull

    // Easter-egg core shake — random jitter that decays after each click.
    if (eggState.shake > 0.001) {
      const s = eggState.shake
      camera.position.x += (Math.random() - 0.5) * s * 7
      camera.position.y += (Math.random() - 0.5) * s * 7
      eggState.shake *= 0.86
    }

    camera.lookAt(pointer.x * 0.4, y - 9, -30)
  })

  return null
}
