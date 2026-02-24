'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Center, Html } from '@react-three/drei'
import { RulerDimensionLine, SquareRoundCorner } from 'lucide-react'
import { useDrawer } from './DrawerContext'
import { createBaseplateForDrawer, createBinForCell } from '@/lib/gridfinity/geometry'
import { canResize, canPlaceCell } from '@/lib/gridfinity/layout'
import { GRIDFINITY, LIMITS } from '@/lib/gridfinity/constants'
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
  valid: boolean
}

function DragGhost({ gridX, gridY, spanX, spanY, gridUnitsX, gridUnitsY, heightUnits, valid }: DragGhostProps) {
  const cellSize = GRIDFINITY.CELL_SIZE
  const totalWidth = gridUnitsX * cellSize
  const totalDepth = gridUnitsY * cellSize
  const x = -(totalWidth / 2) + gridX * cellSize + (spanX * cellSize) / 2
  const z = -(totalDepth / 2) + gridY * cellSize + (spanY * cellSize) / 2
  const h = heightUnits * GRIDFINITY.HEIGHT_UNIT

  return (
    <mesh position={[x, h / 2, z]}>
      <boxGeometry args={[spanX * cellSize - 1, h, spanY * cellSize - 1]} />
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
      { gridUnitsX, gridUnitsY }
    )
    geom.computeVertexNormals()
    return geom
  }, [cell, heightUnits, borderRadius, gridUnitsX, gridUnitsY])

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
  }, [dragging, getWorldPosition, direction, cell, state.cells, gridUnitsX, gridUnitsY, onResize, gl.domElement])

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
      <sphereGeometry args={[dragging ? 4 : hovered ? 3.5 : 3, 16, 16]} />
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
  isSelected,
  onSelect,
  onResize,
  onMove,
}: SelectableBinProps) {
  const { camera, gl } = useThree()
  const { state } = useDrawer()
  const [dragging, setDragging] = useState(false)
  const startPos = useRef<THREE.Vector3 | null>(null)
  const startGrid = useRef({ x: cell.gridX, y: cell.gridY })
  const [ghostPos, setGhostPos] = useState<{ gridX: number; gridY: number; valid: boolean } | null>(null)
  const ghostRef = useRef<{ gridX: number; gridY: number; valid: boolean } | null>(null)
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef(new THREE.Raycaster())
  const pointerIdRef = useRef<number | null>(null)
  const didDrag = useRef(false)
  const onMoveRef = useRef(onMove)

  const cellSize = GRIDFINITY.CELL_SIZE
  const totalWidth = gridUnitsX * cellSize
  const totalDepth = gridUnitsY * cellSize

  const binCenterX = -(totalWidth / 2) + cell.gridX * cellSize + (cell.spanX * cellSize) / 2
  const binCenterZ = -(totalDepth / 2) + cell.gridY * cellSize + (cell.spanY * cellSize) / 2
  const binWidth = cell.spanX * cellSize
  const binDepth = cell.spanY * cellSize
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

  // Document-level drag listeners
  useEffect(() => {
    if (!dragging) return

    const onPointerMove = (e: PointerEvent) => {
      if (!startPos.current) return
      const currentPos = getWorldPosition(e)
      if (!currentPos) return

      const delta = currentPos.clone().sub(startPos.current)
      const deltaUnitsX = Math.round(delta.x / cellSize)
      const deltaUnitsZ = Math.round(delta.z / cellSize)

      if (Math.abs(deltaUnitsX) > 0 || Math.abs(deltaUnitsZ) > 0) {
        didDrag.current = true
      }

      const newGridX = startGrid.current.x + deltaUnitsX
      const newGridY = startGrid.current.y + deltaUnitsZ

      // Check validity
      const movedCell: LayoutCell = { ...cell, gridX: newGridX, gridY: newGridY }
      const otherCells = state.cells.filter((c) => c.id !== cell.id)
      const valid = canPlaceCell(otherCells, movedCell, gridUnitsX, gridUnitsY)

      ghostRef.current = { gridX: newGridX, gridY: newGridY, valid }
      setGhostPos(ghostRef.current)
    }

    const onPointerUp = (e: PointerEvent) => {
      // Attempt the move if we have a valid ghost position
      const ghost = ghostRef.current
      if (ghost && ghost.valid && didDrag.current) {
        onMoveRef.current(ghost.gridX, ghost.gridY)
      }

      setDragging(false)
      ghostRef.current = null
      setGhostPos(null)
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
  }, [dragging, getWorldPosition, cell, state.cells, gridUnitsX, gridUnitsY, cellSize, gl.domElement])

  const handleDragStart = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Don't start drag on resize handles
    setDragging(true)
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
        isSelected={isSelected}
        isDragging={dragging}
        onSelect={onSelect}
        onDragStart={handleDragStart}
      />

      {/* Ghost preview during drag */}
      {dragging && ghostPos && (
        <DragGhost
          gridX={ghostPos.gridX}
          gridY={ghostPos.gridY}
          spanX={cell.spanX}
          spanY={cell.spanY}
          gridUnitsX={gridUnitsX}
          gridUnitsY={gridUnitsY}
          heightUnits={heightUnits}
          valid={ghostPos.valid}
        />
      )}

      {isSelected && !dragging && (
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

// ─── Baseplate ──────────────────────────────────────────────

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

// ─── Grid Overlay ───────────────────────────────────────────

function GridOverlay({ gridUnitsX, gridUnitsY }: { gridUnitsX: number; gridUnitsY: number }) {
  const cellSize = GRIDFINITY.CELL_SIZE
  const totalWidth = gridUnitsX * cellSize
  const totalDepth = gridUnitsY * cellSize

  const geometry = useMemo(() => {
    const allPoints: THREE.Vector3[] = []

    // Vertical lines (along Z)
    for (let x = 0; x <= gridUnitsX; x++) {
      const xPos = -(totalWidth / 2) + x * cellSize
      allPoints.push(
        new THREE.Vector3(xPos, 0, -(totalDepth / 2)),
        new THREE.Vector3(xPos, 0, totalDepth / 2),
      )
    }

    // Horizontal lines (along X)
    for (let y = 0; y <= gridUnitsY; y++) {
      const zPos = -(totalDepth / 2) + y * cellSize
      allPoints.push(
        new THREE.Vector3(-(totalWidth / 2), 0, zPos),
        new THREE.Vector3(totalWidth / 2, 0, zPos),
      )
    }

    const geom = new THREE.BufferGeometry().setFromPoints(allPoints)
    return geom
  }, [gridUnitsX, gridUnitsY, cellSize, totalWidth, totalDepth])

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
  const { state, actions } = useDrawer()
  const orbitRef = useRef<any>(null)

  const maxDim = Math.max(
    state.gridUnitsX * GRIDFINITY.CELL_SIZE,
    state.gridUnitsY * GRIDFINITY.CELL_SIZE,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2.5

  // Disable orbit controls while any resize handle or cell is being dragged
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
            magnetHoles={state.magnetHoles}
            onBackgroundClick={handleBackgroundClick}
          />
          <GridOverlay gridUnitsX={state.gridUnitsX} gridUnitsY={state.gridUnitsY} />
          <group position={[0, GRIDFINITY.BASE_HEIGHT, 0]}>
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

// ─── HUD Overlay (HTML on top of Canvas) ────────────────────

function HudOverlay() {
  const { state, actions, meta } = useDrawer()

  const canAddCell =
    state.gridUnitsX > 0 &&
    state.gridUnitsY > 0 &&
    state.cells.length < state.gridUnitsX * state.gridUnitsY

  const totalCells = state.cells.reduce((acc, cell) => acc + cell.spanX * cell.spanY, 0)
  const gridCells = state.gridUnitsX * state.gridUnitsY

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top-left: Drawer size + Grid controls */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        {/* Drawer dimensions */}
        <div className="pointer-events-auto px-3 py-2 bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-zinc-700/50 flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Drawer</span>
          <input
            type="number"
            value={state.drawerWidthMm}
            min={GRIDFINITY.CELL_SIZE}
            onChange={(e) => actions.setDrawerSize(Number(e.target.value), state.drawerDepthMm)}
            className="w-16 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <span className="text-xs text-zinc-500">×</span>
          <input
            type="number"
            value={state.drawerDepthMm}
            min={GRIDFINITY.CELL_SIZE}
            onChange={(e) => actions.setDrawerSize(state.drawerWidthMm, Number(e.target.value))}
            className="w-16 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <span className="text-xs text-zinc-500">mm</span>
        </div>

        {/* Grid size controls */}
        <div className="pointer-events-auto px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-zinc-700/50 flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Grid</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => actions.setGridUnits(state.gridUnitsX - 1, state.gridUnitsY)}
              disabled={state.gridUnitsX <= LIMITS.GRID_MIN}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-xs rounded transition-colors"
            >
              -
            </button>
            <span className="text-sm font-medium text-zinc-200 tabular-nums min-w-[1.25rem] text-center">
              {state.gridUnitsX}
            </span>
            <button
              onClick={() => actions.setGridUnits(state.gridUnitsX + 1, state.gridUnitsY)}
              disabled={state.gridUnitsX >= Math.min(LIMITS.GRID_MAX, Math.floor(state.drawerWidthMm / GRIDFINITY.CELL_SIZE))}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-xs rounded transition-colors"
            >
              +
            </button>
          </div>

          <span className="text-sm text-zinc-500">×</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => actions.setGridUnits(state.gridUnitsX, state.gridUnitsY - 1)}
              disabled={state.gridUnitsY <= LIMITS.GRID_MIN}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-xs rounded transition-colors"
            >
              -
            </button>
            <span className="text-sm font-medium text-zinc-200 tabular-nums min-w-[1.25rem] text-center">
              {state.gridUnitsY}
            </span>
            <button
              onClick={() => actions.setGridUnits(state.gridUnitsX, state.gridUnitsY + 1)}
              disabled={state.gridUnitsY >= Math.min(LIMITS.GRID_MAX, Math.floor(state.drawerDepthMm / GRIDFINITY.CELL_SIZE))}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-xs rounded transition-colors"
            >
              +
            </button>
          </div>

          <span className="w-px h-4 bg-zinc-700" />

          <span className="text-sm text-zinc-400">
            {state.cells.length} bin{state.cells.length !== 1 ? 's' : ''}
          </span>
          {gridCells > 0 && (
            <>
              <span className="w-px h-4 bg-zinc-700" />
              <span className="text-sm text-zinc-500">
                {Math.round((totalCells / gridCells) * 100)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom-center toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-700/50">
          {/* Add Cell */}
          <button
            onClick={() => actions.addCell()}
            disabled={!canAddCell}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
            title="Add Cell"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <span className="w-px h-6 bg-zinc-700 mx-1" />

          {/* Height controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => actions.setHeightUnits(state.heightUnits - 1)}
              disabled={state.heightUnits <= LIMITS.HEIGHT_MIN}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              -
            </button>
            <span className="px-1.5 text-sm font-medium text-zinc-200 tabular-nums flex items-center gap-1.5" title={`Height: ${state.heightUnits}u (${state.heightUnits * GRIDFINITY.HEIGHT_UNIT}mm)`}>
              <RulerDimensionLine className="w-4 h-4 text-zinc-400 rotate-90" />
              {state.heightUnits}u
            </span>
            <button
              onClick={() => actions.setHeightUnits(state.heightUnits + 1)}
              disabled={state.heightUnits >= LIMITS.HEIGHT_MAX}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              +
            </button>
          </div>

          <span className="w-px h-6 bg-zinc-700 mx-1" />

          {/* Border radius quick control */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => actions.setBorderRadius(Math.max(LIMITS.BORDER_RADIUS_MIN, +(state.borderRadius - 0.5).toFixed(1)))}
              disabled={state.borderRadius <= LIMITS.BORDER_RADIUS_MIN}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              -
            </button>
            <span className="px-1.5 text-sm text-zinc-200 tabular-nums flex items-center gap-1.5" title={`Border Radius: ${state.borderRadius}mm`}>
              <SquareRoundCorner className="w-4 h-4 text-zinc-400" />
              {state.borderRadius}
            </span>
            <button
              onClick={() => actions.setBorderRadius(Math.min(LIMITS.BORDER_RADIUS_MAX, +(state.borderRadius + 0.5).toFixed(1)))}
              disabled={state.borderRadius >= LIMITS.BORDER_RADIUS_MAX}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Selected cell floating panel */}
      {meta.selectedCell && (
        <SelectedCellPanel cell={meta.selectedCell} />
      )}
    </div>
  )
}

function SelectedCellPanel({ cell }: { cell: LayoutCell }) {
  const { actions, state } = useDrawer()

  // Position the panel near the top-right of the viewer
  return (
    <div className="absolute top-3 right-3 pointer-events-auto">
      <div className="px-3 py-2 bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-emerald-500/30 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-zinc-200">
            {cell.spanX}x{cell.spanY}
          </span>
          <span className="text-xs text-zinc-500">
            at ({cell.gridX},{cell.gridY})
          </span>
        </div>
        <button
          onClick={() => actions.deleteCell(cell.id)}
          className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors"
          title="Delete cell"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Exported DrawerViewer ──────────────────────────────────

export function DrawerViewer() {
  const { state } = useDrawer()

  const maxDim = Math.max(
    state.gridUnitsX * GRIDFINITY.CELL_SIZE || 100,
    state.gridUnitsY * GRIDFINITY.CELL_SIZE || 100,
    state.heightUnits * GRIDFINITY.HEIGHT_UNIT
  )
  const cameraDistance = maxDim * 2

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-zinc-800 to-zinc-900">
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
