'use client'

import { useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei'
import { useDrawer } from './DrawerContext'
import { createBaseplateForDrawer, createBinForCell } from '@/lib/gridfinity/geometry'
import { canResize } from '@/lib/gridfinity/layout'
import { GRIDFINITY } from '@/lib/gridfinity/constants'
import type { LayoutCell } from '@/lib/gridfinity/layout'
import * as THREE from 'three'

type BinMeshProps = {
  cell: LayoutCell
  heightUnits: number
  borderRadius: number
  gridUnitsX: number
  gridUnitsY: number
  isSelected: boolean
  onSelect: () => void
}

function BinMesh({
  cell,
  heightUnits,
  borderRadius,
  gridUnitsX,
  gridUnitsY,
  isSelected,
  onSelect,
}: BinMeshProps) {
  const [hovered, setHovered] = useState(false)

  const geometry = useMemo(() => {
    const geom = createBinForCell(
      cell,
      { heightUnits, borderRadius },
      { gridUnitsX, gridUnitsY }
    )
    geom.computeVertexNormals()
    return geom
  }, [cell, heightUnits, borderRadius, gridUnitsX, gridUnitsY])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }, [onSelect])

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={isSelected ? '#059669' : hovered ? '#34d399' : '#10b981'}
        metalness={0.15}
        roughness={0.35}
      />
    </mesh>
  )
}

type ResizeHandleProps = {
  position: [number, number, number]
  direction: 'x' | 'y' | 'xy'
  cell: LayoutCell
  gridUnitsX: number
  gridUnitsY: number
  onResize: (newSpanX: number, newSpanY: number) => void
}

function ResizeHandle({ position, direction, cell, gridUnitsX, gridUnitsY, onResize }: ResizeHandleProps) {
  const { camera, gl } = useThree()
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const startPos = useRef<THREE.Vector3 | null>(null)
  const startSpan = useRef({ x: cell.spanX, y: cell.spanY })
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())

  const { state } = useDrawer()

  const getWorldPosition = useCallback((e: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.current.setFromCamera(mouse, camera)
    const intersection = new THREE.Vector3()
    const hit = raycaster.current.ray.intersectPlane(planeRef.current, intersection)
    return hit ? intersection : null
  }, [camera, gl])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setDragging(true)
    startSpan.current = { x: cell.spanX, y: cell.spanY }
    const worldPos = getWorldPosition(e.nativeEvent)
    if (worldPos) {
      startPos.current = worldPos.clone()
    }
    gl.domElement.setPointerCapture(e.pointerId)
  }, [cell.spanX, cell.spanY, getWorldPosition, gl.domElement])

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragging || !startPos.current) return

    const currentPos = getWorldPosition(e.nativeEvent)
    if (!currentPos) return

    const delta = currentPos.clone().sub(startPos.current)
    const cellSize = GRIDFINITY.CELL_SIZE

    let newSpanX = startSpan.current.x
    let newSpanY = startSpan.current.y

    if (direction === 'x' || direction === 'xy') {
      const deltaUnitsX = Math.round(delta.x / cellSize)
      newSpanX = Math.max(1, startSpan.current.x + deltaUnitsX)
    }
    if (direction === 'y' || direction === 'xy') {
      const deltaUnitsY = Math.round(delta.z / cellSize)
      newSpanY = Math.max(1, startSpan.current.y + deltaUnitsY)
    }

    if (newSpanX !== cell.spanX || newSpanY !== cell.spanY) {
      if (canResize(state.cells, cell.id, newSpanX, newSpanY, gridUnitsX, gridUnitsY)) {
        onResize(newSpanX, newSpanY)
      }
    }
  }, [dragging, getWorldPosition, direction, cell, state.cells, gridUnitsX, gridUnitsY, onResize])

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    setDragging(false)
    startPos.current = null
    gl.domElement.releasePointerCapture(e.pointerId)
  }, [gl.domElement])

  const getCursor = () => {
    if (direction === 'x') return 'ew-resize'
    if (direction === 'y') return 'ns-resize'
    return 'nwse-resize'
  }

  return (
    <mesh
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = getCursor()
      }}
      onPointerOut={() => {
        setHovered(false)
        if (!dragging) document.body.style.cursor = 'auto'
      }}
    >
      <sphereGeometry args={[dragging ? 4 : hovered ? 3.5 : 3, 16, 16]} />
      <meshStandardMaterial
        color={dragging ? '#fbbf24' : hovered ? '#34d399' : '#10b981'}
        emissive={dragging ? '#fbbf24' : '#000000'}
        emissiveIntensity={dragging ? 0.3 : 0}
      />
    </mesh>
  )
}

type SelectableBinProps = {
  cell: LayoutCell
  heightUnits: number
  borderRadius: number
  gridUnitsX: number
  gridUnitsY: number
  isSelected: boolean
  onSelect: () => void
  onResize: (spanX: number, spanY: number) => void
}

function SelectableBin({
  cell,
  heightUnits,
  borderRadius,
  gridUnitsX,
  gridUnitsY,
  isSelected,
  onSelect,
  onResize,
}: SelectableBinProps) {
  const cellSize = GRIDFINITY.CELL_SIZE
  const totalWidth = gridUnitsX * cellSize
  const totalDepth = gridUnitsY * cellSize

  // Calculate bin position (same logic as createBinForCell)
  const binCenterX = -(totalWidth / 2) + cell.gridX * cellSize + (cell.spanX * cellSize) / 2
  const binCenterZ = -(totalDepth / 2) + cell.gridY * cellSize + (cell.spanY * cellSize) / 2
  const binWidth = cell.spanX * cellSize
  const binDepth = cell.spanY * cellSize
  const binHeight = heightUnits * GRIDFINITY.HEIGHT_UNIT

  return (
    <group>
      <BinMesh
        cell={cell}
        heightUnits={heightUnits}
        borderRadius={borderRadius}
        gridUnitsX={gridUnitsX}
        gridUnitsY={gridUnitsY}
        isSelected={isSelected}
        onSelect={onSelect}
      />

      {isSelected && (
        <>
          {/* East handle (X+) */}
          <ResizeHandle
            position={[binCenterX + binWidth / 2, binHeight / 2, binCenterZ]}
            direction="x"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            onResize={onResize}
          />
          {/* South handle (Z+) */}
          <ResizeHandle
            position={[binCenterX, binHeight / 2, binCenterZ + binDepth / 2]}
            direction="y"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            onResize={onResize}
          />
          {/* Corner handle (X+ Z+) */}
          <ResizeHandle
            position={[binCenterX + binWidth / 2, binHeight / 2, binCenterZ + binDepth / 2]}
            direction="xy"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            onResize={onResize}
          />
        </>
      )}
    </group>
  )
}

type BaseplateMeshProps = {
  gridUnitsX: number
  gridUnitsY: number
  borderRadius: number
  magnetHoles: boolean
  onBackgroundClick: () => void
}

function BaseplateMesh({
  gridUnitsX,
  gridUnitsY,
  borderRadius,
  magnetHoles,
  onBackgroundClick,
}: BaseplateMeshProps) {
  const geometry = useMemo(() => {
    const geom = createBaseplateForDrawer(gridUnitsX, gridUnitsY, {
      borderRadius,
      magnetHoles,
    })
    geom.computeVertexNormals()
    return geom
  }, [gridUnitsX, gridUnitsY, borderRadius, magnetHoles])

  return (
    <mesh geometry={geometry} receiveShadow onClick={onBackgroundClick}>
      <meshStandardMaterial color="#52525b" metalness={0.3} roughness={0.5} />
    </mesh>
  )
}

function Scene() {
  const { state, actions } = useDrawer()

  const maxDim = Math.max(
    state.gridUnitsX * GRIDFINITY.CELL_SIZE,
    state.gridUnitsY * GRIDFINITY.CELL_SIZE,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2.5

  const handleBackgroundClick = useCallback(() => {
    actions.selectCell(null)
  }, [actions])

  const handleResize = useCallback((cellId: string, spanX: number, spanY: number) => {
    actions.resizeCell(cellId, spanX, spanY)
  }, [actions])

  if (state.gridUnitsX === 0 || state.gridUnitsY === 0) {
    return null
  }

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.4} />

      <Center>
        <group>
          <BaseplateMesh
            gridUnitsX={state.gridUnitsX}
            gridUnitsY={state.gridUnitsY}
            borderRadius={state.borderRadius}
            magnetHoles={state.magnetHoles}
            onBackgroundClick={handleBackgroundClick}
          />
          {state.cells.map((cell) => (
            <SelectableBin
              key={cell.id}
              cell={cell}
              heightUnits={state.heightUnits}
              borderRadius={state.borderRadius}
              gridUnitsX={state.gridUnitsX}
              gridUnitsY={state.gridUnitsY}
              isSelected={cell.id === state.selectedCellId}
              onSelect={() => actions.selectCell(cell.id)}
              onResize={(spanX, spanY) => handleResize(cell.id, spanX, spanY)}
            />
          ))}
        </group>
      </Center>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.5}
        scale={maxDim * 3}
        blur={2.5}
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

      <Environment preset="night" />
    </>
  )
}

export function DrawerViewer() {
  const { state } = useDrawer()

  const maxDim = Math.max(
    state.gridUnitsX * GRIDFINITY.CELL_SIZE || 100,
    state.gridUnitsY * GRIDFINITY.CELL_SIZE || 100,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2

  return (
    <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-zinc-900">
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
        <color attach="background" args={['#18181b']} />
        <Scene />
      </Canvas>
    </div>
  )
}
