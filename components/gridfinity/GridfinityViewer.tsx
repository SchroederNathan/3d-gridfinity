'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei'
import { GridfinityMesh } from './GridfinityMesh'
import { useGridfinity } from './GridfinityContext'

function Scene() {
  const { meta } = useGridfinity()
  const maxDim = Math.max(meta.dimensions.width, meta.dimensions.depth, meta.dimensions.height)
  const cameraDistance = maxDim * 2.5

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      <Center>
        <GridfinityMesh />
      </Center>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={maxDim * 3}
        blur={2}
        far={maxDim}
      />

      <OrbitControls
        makeDefault
        minDistance={cameraDistance * 0.3}
        maxDistance={cameraDistance * 3}
        enablePan
        enableZoom
        enableRotate
      />

      <Environment preset="studio" />
    </>
  )
}

export function GridfinityViewer() {
  const { meta } = useGridfinity()
  const maxDim = Math.max(meta.dimensions.width, meta.dimensions.depth, meta.dimensions.height)
  const cameraDistance = maxDim * 2

  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-b from-neutral-100 to-neutral-200 rounded-lg overflow-hidden">
      <Canvas
        camera={{
          position: [cameraDistance, cameraDistance * 0.8, cameraDistance],
          fov: 45,
          near: 0.1,
          far: maxDim * 20,
        }}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
