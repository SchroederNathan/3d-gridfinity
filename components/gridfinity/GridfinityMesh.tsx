'use client'

import { useMemo } from 'react'
import { useGridfinity } from './GridfinityContext'
import { createGridfinityGeometry } from '@/lib/gridfinity/geometry'

export function GridfinityMesh() {
  const { state } = useGridfinity()

  const geometry = useMemo(() => {
    const geom = createGridfinityGeometry(state)
    geom.computeVertexNormals()
    return geom
  }, [state])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#4a9eff"
        metalness={0.1}
        roughness={0.4}
      />
    </mesh>
  )
}
