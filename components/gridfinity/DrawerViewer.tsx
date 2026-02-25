'use client'

import { useMemo, useRef, useState, useCallback, useEffect, useReducer } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei'
import { useDrawer } from './DrawerContext'
import { HudToolbar } from './HudToolbar'
import { createBaseplateForDrawer, createBinForCell } from '@/lib/gridfinity/geometry'
import { canResize, canPlaceCell } from '@/lib/gridfinity/layout'
import { GRIDFINITY } from '@/lib/gridfinity/constants'
import type { LayoutCell } from '@/lib/gridfinity/layout'
import * as THREE from 'three'

// ─── Ghost Preview (shown during drag) ──────────────────────

type DragGhostProps = {
  gridX: number
  gridY: number
  spanX: number
  spanY: number
  gridUnitsX: number
  gridUnitsY: number
  heightUnits: number
  cellSizeX: number
  cellSizeY: number
  valid: boolean
}

function DragGhost({ gridX, gridY, spanX, spanY, gridUnitsX, gridUnitsY, heightUnits, cellSizeX, cellSizeY, valid }: DragGhostProps) {
  const totalWidth = gridUnitsX * cellSizeX
  const totalDepth = gridUnitsY * cellSizeY
  const x = -(totalWidth / 2) + gridX * cellSizeX + (spanX * cellSizeX) / 2
  const z = -(totalDepth / 2) + gridY * cellSizeY + (spanY * cellSizeY) / 2
  const h = heightUnits * GRIDFINITY.HEIGHT_UNIT

  return (
    <mesh position={[x, h / 2, z]}>
      <boxGeometry args={[spanX * cellSizeX - 1, h, spanY * cellSizeY - 1]} />
      <meshStandardMaterial
        color={valid ? '#10b981' : '#ef4444'}
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </mesh>
  )
}

// ─── BinMesh ────────────────────────────────────────────────

type BinMeshProps = {
  cell: LayoutCell
  heightUnits: number
  borderRadius: number
  gridUnitsX: number
  gridUnitsY: number
  cellSizeX: number
  cellSizeY: number
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onDragStart: (e: ThreeEvent<PointerEvent>) => void
}

function BinMesh({
  cell,
  heightUnits,
  borderRadius,
  gridUnitsX,
  gridUnitsY,
  cellSizeX,
  cellSizeY,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
}: BinMeshProps) {
  const [hovered, setHovered] = useState(false)

  const geometry = useMemo(() => {
    const geom = createBinForCell(
      cell,
      { heightUnits, borderRadius },
      { gridUnitsX, gridUnitsY, cellSizeX, cellSizeY }
    )
    geom.computeVertexNormals()
    return geom
  }, [cell, heightUnits, borderRadius, gridUnitsX, gridUnitsY, cellSizeX, cellSizeY])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }, [onSelect])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onDragStart(e)
  }, [onDragStart])

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      <meshStandardMaterial
        color={isSelected ? '#059669' : hovered ? '#34d399' : '#10b981'}
        metalness={0.15}
        roughness={0.35}
        transparent={isDragging}
        opacity={isDragging ? 0.5 : 1}
      />
    </mesh>
  )
}

// ─── Resize Handle ──────────────────────────────────────────

type ResizeHandleProps = {
  position: [number, number, number]
  direction: 'x' | 'y' | 'xy'
  cell: LayoutCell
  gridUnitsX: number
  gridUnitsY: number
  cellSizeX: number
  cellSizeY: number
  onResize: (newSpanX: number, newSpanY: number) => void
}

function ResizeHandle({ position, direction, cell, gridUnitsX, gridUnitsY, cellSizeX, cellSizeY, onResize }: ResizeHandleProps) {
  const { camera, gl } = useThree()
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const startPos = useRef<THREE.Vector3 | null>(null)
  const startSpan = useRef({ x: cell.spanX, y: cell.spanY })
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointerIdRef = useRef<number | null>(null)

  const { state } = useDrawer()

  const getWorldPosition = useCallback((e: PointerEvent | MouseEvent): THREE.Vector3 | null => {
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

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (!startPos.current) return

      const currentPos = getWorldPosition(e)
      if (!currentPos) return

      const delta = currentPos.clone().sub(startPos.current)

      let newSpanX = startSpan.current.x
      let newSpanY = startSpan.current.y

      if (direction === 'x' || direction === 'xy') {
        const deltaUnitsX = Math.round(delta.x / cellSizeX)
        newSpanX = Math.max(1, startSpan.current.x + deltaUnitsX)
      }
      if (direction === 'y' || direction === 'xy') {
        const deltaUnitsY = Math.round(delta.z / cellSizeY)
        newSpanY = Math.max(1, startSpan.current.y + deltaUnitsY)
      }

      if (canResize(state.cells, cell.id, newSpanX, newSpanY, gridUnitsX, gridUnitsY)) {
        onResize(newSpanX, newSpanY)
      }
    }

    const onUp = (e: PointerEvent) => {
      setDragging(false)
      startPos.current = null
      if (pointerIdRef.current !== null) {
        try { gl.domElement.releasePointerCapture(pointerIdRef.current) } catch {}
      }
      pointerIdRef.current = null
      document.body.style.cursor = 'auto'
      document.dispatchEvent(new Event('resize-handle-end'))
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [dragging, getWorldPosition, direction, cell, state.cells, gridUnitsX, gridUnitsY, cellSizeX, cellSizeY, onResize, gl.domElement])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setDragging(true)
    startSpan.current = { x: cell.spanX, y: cell.spanY }
    const worldPos = getWorldPosition(e.nativeEvent)
    if (worldPos) {
      startPos.current = worldPos.clone()
    }
    pointerIdRef.current = e.pointerId
    gl.domElement.setPointerCapture(e.pointerId)
    document.dispatchEvent(new Event('resize-handle-start'))
  }, [cell.spanX, cell.spanY, getWorldPosition, gl.domElement])

  const getCursor = () => {
    if (direction === 'x') return 'ew-resize'
    if (direction === 'y') return 'ns-resize'
    return 'nwse-resize'
  }

  return (
    <mesh
      position={position}
      onPointerDown={handlePointerDown}
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
      <sphereGeometry args={[dragging ? 6 : hovered ? 5.5 : 5, 16, 16]} />
      <meshStandardMaterial
        color={dragging ? '#fbbf24' : hovered ? '#34d399' : '#10b981'}
        emissive={dragging ? '#fbbf24' : '#000000'}
        emissiveIntensity={dragging ? 0.3 : 0}
      />
    </mesh>
  )
}

// ─── Selectable Bin (with resize handles + drag) ────────────

type SelectableBinProps = {
  cell: LayoutCell
  heightUnits: number
  borderRadius: number
  gridUnitsX: number
  gridUnitsY: number
  cellSizeX: number
  cellSizeY: number
  isSelected: boolean
  onSelect: () => void
  onResize: (spanX: number, spanY: number) => void
  onMove: (gridX: number, gridY: number) => boolean
}

function SelectableBin({
  cell,
  heightUnits,
  borderRadius,
  gridUnitsX,
  gridUnitsY,
  cellSizeX,
  cellSizeY,
  isSelected,
  onSelect,
  onResize,
  onMove,
}: SelectableBinProps) {
  const { camera, gl } = useThree()
  const { state } = useDrawer()

  type DragState = {
    dragging: boolean
    ghostPos: { gridX: number; gridY: number; valid: boolean } | null
  }
  type DragAction =
    | { type: 'start' }
    | { type: 'move'; ghostPos: { gridX: number; gridY: number; valid: boolean } }
    | { type: 'end' }

  const [dragState, dispatchDrag] = useReducer(
    (state: DragState, action: DragAction): DragState => {
      switch (action.type) {
        case 'start': return { dragging: true, ghostPos: null }
        case 'move': return { ...state, ghostPos: action.ghostPos }
        case 'end': return { dragging: false, ghostPos: null }
      }
    },
    { dragging: false, ghostPos: null }
  )

  const startPos = useRef<THREE.Vector3 | null>(null)
  const startGrid = useRef({ x: cell.gridX, y: cell.gridY })
  const ghostRef = useRef<{ gridX: number; gridY: number; valid: boolean } | null>(null)
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointerIdRef = useRef<number | null>(null)
  const didDrag = useRef(false)
  const onMoveRef = useRef(onMove)

  const totalWidth = gridUnitsX * cellSizeX
  const totalDepth = gridUnitsY * cellSizeY

  const { dragging, ghostPos } = dragState

  const binCenterX = -(totalWidth / 2) + cell.gridX * cellSizeX + (cell.spanX * cellSizeX) / 2
  const binCenterZ = -(totalDepth / 2) + cell.gridY * cellSizeY + (cell.spanY * cellSizeY) / 2
  const binWidth = cell.spanX * cellSizeX
  const binDepth = cell.spanY * cellSizeY
  const binHeight = heightUnits * GRIDFINITY.HEIGHT_UNIT

  const getWorldPosition = useCallback((e: PointerEvent | MouseEvent): THREE.Vector3 | null => {
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

  onMoveRef.current = onMove

  useEffect(() => {
    if (!dragging) return

    const onPointerMove = (e: PointerEvent) => {
      if (!startPos.current) return
      const currentPos = getWorldPosition(e)
      if (!currentPos) return

      const delta = currentPos.clone().sub(startPos.current)
      const deltaUnitsX = Math.round(delta.x / cellSizeX)
      const deltaUnitsZ = Math.round(delta.z / cellSizeY)

      if (Math.abs(deltaUnitsX) > 0 || Math.abs(deltaUnitsZ) > 0) {
        didDrag.current = true
      }

      const newGridX = startGrid.current.x + deltaUnitsX
      const newGridY = startGrid.current.y + deltaUnitsZ

      const movedCell: LayoutCell = { ...cell, gridX: newGridX, gridY: newGridY }
      const otherCells = state.cells.filter((c) => c.id !== cell.id)
      const valid = canPlaceCell(otherCells, movedCell, gridUnitsX, gridUnitsY)

      ghostRef.current = { gridX: newGridX, gridY: newGridY, valid }
      dispatchDrag({ type: 'move', ghostPos: ghostRef.current })
    }

    const onPointerUp = (e: PointerEvent) => {
      const ghost = ghostRef.current
      if (ghost && ghost.valid && didDrag.current) {
        onMoveRef.current(ghost.gridX, ghost.gridY)
      }

      dispatchDrag({ type: 'end' })
      ghostRef.current = null
      startPos.current = null
      didDrag.current = false
      if (pointerIdRef.current !== null) {
        try { gl.domElement.releasePointerCapture(pointerIdRef.current) } catch {}
      }
      pointerIdRef.current = null
      document.body.style.cursor = 'auto'
      document.dispatchEvent(new Event('drag-cell-end'))
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, getWorldPosition, cell, state.cells, gridUnitsX, gridUnitsY, cellSizeX, cellSizeY, gl.domElement])

  const handleDragStart = useCallback((e: ThreeEvent<PointerEvent>) => {
    dispatchDrag({ type: 'start' })
    didDrag.current = false
    startGrid.current = { x: cell.gridX, y: cell.gridY }
    const worldPos = getWorldPosition(e.nativeEvent)
    if (worldPos) {
      startPos.current = worldPos.clone()
    }
    pointerIdRef.current = e.pointerId
    gl.domElement.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'grabbing'
    document.dispatchEvent(new Event('drag-cell-start'))
  }, [cell.gridX, cell.gridY, getWorldPosition, gl.domElement])

  return (
    <group>
      <BinMesh
        cell={cell}
        heightUnits={heightUnits}
        borderRadius={borderRadius}
        gridUnitsX={gridUnitsX}
        gridUnitsY={gridUnitsY}
        cellSizeX={cellSizeX}
        cellSizeY={cellSizeY}
        isSelected={isSelected}
        isDragging={dragging}
        onSelect={onSelect}
        onDragStart={handleDragStart}
      />

      {dragging && ghostPos && (
        <DragGhost
          gridX={ghostPos.gridX}
          gridY={ghostPos.gridY}
          spanX={cell.spanX}
          spanY={cell.spanY}
          gridUnitsX={gridUnitsX}
          gridUnitsY={gridUnitsY}
          heightUnits={heightUnits}
          cellSizeX={cellSizeX}
          cellSizeY={cellSizeY}
          valid={ghostPos.valid}
        />
      )}

      {isSelected && !dragging && (
        <>
          <ResizeHandle
            position={[binCenterX + binWidth / 2, binHeight / 2, binCenterZ]}
            direction="x"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            cellSizeX={cellSizeX}
            cellSizeY={cellSizeY}
            onResize={onResize}
          />
          <ResizeHandle
            position={[binCenterX, binHeight / 2, binCenterZ + binDepth / 2]}
            direction="y"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            cellSizeX={cellSizeX}
            cellSizeY={cellSizeY}
            onResize={onResize}
          />
          <ResizeHandle
            position={[binCenterX + binWidth / 2, binHeight / 2, binCenterZ + binDepth / 2]}
            direction="xy"
            cell={cell}
            gridUnitsX={gridUnitsX}
            gridUnitsY={gridUnitsY}
            cellSizeX={cellSizeX}
            cellSizeY={cellSizeY}
            onResize={onResize}
          />
        </>
      )}
    </group>
  )
}

// ─── Baseplate ──────────────────────────────────────────────

type BaseplateMeshProps = {
  gridUnitsX: number
  gridUnitsY: number
  borderRadius: number
  cellSizeX: number
  cellSizeY: number
  onBackgroundClick: () => void
}

function BaseplateMesh({
  gridUnitsX,
  gridUnitsY,
  borderRadius,
  cellSizeX,
  cellSizeY,
  onBackgroundClick,
}: BaseplateMeshProps) {
  const geometry = useMemo(() => {
    const geom = createBaseplateForDrawer(gridUnitsX, gridUnitsY, {
      borderRadius,
    }, { cellSizeX, cellSizeY })
    geom.computeVertexNormals()
    return geom
  }, [gridUnitsX, gridUnitsY, borderRadius, cellSizeX, cellSizeY])

  return (
    <mesh geometry={geometry} receiveShadow onClick={onBackgroundClick}>
      <meshStandardMaterial color="#52525b" metalness={0.3} roughness={0.5} />
    </mesh>
  )
}

// ─── Grid Overlay ───────────────────────────────────────────

function GridOverlay({ gridUnitsX, gridUnitsY, cellSizeX, cellSizeY }: { gridUnitsX: number; gridUnitsY: number; cellSizeX: number; cellSizeY: number }) {
  const totalWidth = gridUnitsX * cellSizeX
  const totalDepth = gridUnitsY * cellSizeY

  const geometry = useMemo(() => {
    const allPoints: THREE.Vector3[] = []

    for (let x = 0; x <= gridUnitsX; x++) {
      const xPos = -(totalWidth / 2) + x * cellSizeX
      allPoints.push(
        new THREE.Vector3(xPos, 0, -(totalDepth / 2)),
        new THREE.Vector3(xPos, 0, totalDepth / 2),
      )
    }

    for (let y = 0; y <= gridUnitsY; y++) {
      const zPos = -(totalDepth / 2) + y * cellSizeY
      allPoints.push(
        new THREE.Vector3(-(totalWidth / 2), 0, zPos),
        new THREE.Vector3(totalWidth / 2, 0, zPos),
      )
    }

    const geom = new THREE.BufferGeometry().setFromPoints(allPoints)
    return geom
  }, [gridUnitsX, gridUnitsY, cellSizeX, cellSizeY, totalWidth, totalDepth])

  return (
    <group position={[0, GRIDFINITY.BASE_HEIGHT + 0.5, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#a1a1aa" transparent opacity={0.4} depthTest={false} />
      </lineSegments>
    </group>
  )
}

// ─── Scene (3D content) ─────────────────────────────────────

function Scene() {
  const { state, actions, meta } = useDrawer()
  const orbitRef = useRef<any>(null)
  const { cellSizeX, cellSizeY } = meta

  const maxDim = Math.max(
    state.drawerWidthMm,
    state.drawerDepthMm,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2.5

  useEffect(() => {
    const onDown = () => { if (orbitRef.current) orbitRef.current.enabled = false }
    const onUp = () => { if (orbitRef.current) orbitRef.current.enabled = true }
    document.addEventListener('resize-handle-start', onDown)
    document.addEventListener('resize-handle-end', onUp)
    document.addEventListener('drag-cell-start', onDown)
    document.addEventListener('drag-cell-end', onUp)
    return () => {
      document.removeEventListener('resize-handle-start', onDown)
      document.removeEventListener('resize-handle-end', onUp)
      document.removeEventListener('drag-cell-start', onDown)
      document.removeEventListener('drag-cell-end', onUp)
    }
  }, [])

  const handleBackgroundClick = useCallback(() => {
    actions.selectCell(null)
  }, [actions])

  const handleResize = useCallback((cellId: string, spanX: number, spanY: number) => {
    actions.resizeCell(cellId, spanX, spanY)
  }, [actions])

  const handleMove = useCallback((cellId: string, gridX: number, gridY: number) => {
    return actions.moveCell(cellId, gridX, gridY)
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
            cellSizeX={cellSizeX}
            cellSizeY={cellSizeY}
            onBackgroundClick={handleBackgroundClick}
          />
          <GridOverlay gridUnitsX={state.gridUnitsX} gridUnitsY={state.gridUnitsY} cellSizeX={cellSizeX} cellSizeY={cellSizeY} />
          <group position={[0, GRIDFINITY.BASE_HEIGHT, 0]}>
            {state.cells.map((cell) => (
              <SelectableBin
                key={cell.id}
                cell={cell}
                heightUnits={state.heightUnits}
                borderRadius={state.borderRadius}
                gridUnitsX={state.gridUnitsX}
                gridUnitsY={state.gridUnitsY}
                cellSizeX={cellSizeX}
                cellSizeY={cellSizeY}
                isSelected={cell.id === state.selectedCellId}
                onSelect={() => actions.selectCell(cell.id)}
                onResize={(spanX, spanY) => handleResize(cell.id, spanX, spanY)}
                onMove={(gridX, gridY) => handleMove(cell.id, gridX, gridY)}
              />
            ))}
          </group>
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
        ref={orbitRef}
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

// ─── HUD Overlay ────────────────────────────────────────────

function HudOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <HudToolbar />
    </div>
  )
}

// ─── Exported DrawerViewer ──────────────────────────────────

export function DrawerViewer() {
  const { state, meta } = useDrawer()

  const maxDim = Math.max(
    state.drawerWidthMm || 100,
    state.drawerDepthMm || 100,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2

  return (
    <div className="relative w-screen h-screen bg-zinc-950">
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
      <HudOverlay />
    </div>
  )
}
