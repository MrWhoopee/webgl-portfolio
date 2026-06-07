'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

const vertexShader = `
  varying float vHeight;
  varying vec3 vPos;
  void main() {
    vHeight = position.y;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying float vHeight;
  uniform float uMaxHeight;
  void main() {
    float t = clamp(vHeight / uMaxHeight, 0.0, 1.0);
    vec3 purple = vec3(0.486, 0.196, 0.929); // #7C32ED
    vec3 pink   = vec3(0.925, 0.286, 0.600); // #EC4999
    vec3 color  = mix(purple, pink, t);
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function SynthwaveTerrain() {
  const MAX_HEIGHT = 32.0

  const geometry = useMemo(() => {
    const noise2D = createNoise2D()
    const geo = new THREE.PlaneGeometry(320, 160, 220, 110)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)

      // Layered noise for natural-ish mountains
      let y = noise2D(x * 0.012, z * 0.012) * 24
      y += noise2D(x * 0.028, z * 0.028) * 10
      y += noise2D(x * 0.07, z * 0.07) * 4

      // Keep only positive heights (peaks above flat ground)
      y = Math.max(0, y)

      // Asymmetry — right side leans higher (user's request)
      y += (x / 320) * 10

      pos.setY(i, y)
    }

    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} position={[0, -2, -65]}>
      <shaderMaterial
        wireframe
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uMaxHeight: { value: MAX_HEIGHT } }}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
