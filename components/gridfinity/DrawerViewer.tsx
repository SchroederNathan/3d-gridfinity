'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei'
import {
  Plus,
  Minus,
  Download,
  Grid3x3,
  Magnet,
  Trash2,
  Ruler,
  RulerDimensionLine,
  SquareRoundCorner,
  Undo2,
  Redo2,
  LayoutTemplate,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDrawer } from './DrawerContext'
import { createBaseplateForDrawer, createBinForCell } from '@/lib/gridfinity/geometry'
import { canResize, canPlaceCell } from '@/lib/gridfinity/layout'
import { GRIDFINITY, LIMITS } from '@/lib/gridfinity/constants'
import {
  generateSTLBlob,
  downloadBlob,
  generateDrawerBaseplateFilename,
  mergeGeometriesForExport,
} from '@/lib/gridfinity/export-stl'
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

  const totalWidth = gridUnitsX * cellSizeX
  const totalDepth = gridUnitsY * cellSizeY

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
      setGhostPos(ghostRef.current)
    }

    const onPointerUp = (e: PointerEvent) => {
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
  }, [dragging, getWorldPosition, cell, state.cells, gridUnitsX, gridUnitsY, cellSizeX, cellSizeY, gl.domElement])

  const handleDragStart = useCallback((e: ThreeEvent<PointerEvent>) => {
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
  magnetHoles: boolean
  cellSizeX: number
  cellSizeY: number
  onBackgroundClick: () => void
}

function BaseplateMesh({
  gridUnitsX,
  gridUnitsY,
  borderRadius,
  magnetHoles,
  cellSizeX,
  cellSizeY,
  onBackgroundClick,
}: BaseplateMeshProps) {
  const geometry = useMemo(() => {
    const geom = createBaseplateForDrawer(gridUnitsX, gridUnitsY, {
      borderRadius,
      magnetHoles,
    }, { cellSizeX, cellSizeY })
    geom.computeVertexNormals()
    return geom
  }, [gridUnitsX, gridUnitsY, borderRadius, magnetHoles, cellSizeX, cellSizeY])

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
            magnetHoles={state.magnetHoles}
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

// ─── Stepper Control ────────────────────────────────────────

type StepperProps = {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  disableDecrement: boolean
  disableIncrement: boolean
  suffix?: string
  title?: string
}

function Stepper({ value, onDecrement, onIncrement, disableDecrement, disableIncrement, suffix, title }: StepperProps) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onDecrement}
        disabled={disableDecrement}
        aria-label={`Decrease ${title ?? 'value'}`}
        className="h-7 w-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="min-w-[2rem] text-center text-sm font-medium text-zinc-200 tabular-nums" title={title}>
        {value}{suffix}
      </span>
      <button
        onClick={onIncrement}
        disabled={disableIncrement}
        aria-label={`Increase ${title ?? 'value'}`}
        className="h-7 w-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Toggle Switch ──────────────────────────────────────────

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`
        relative h-6 w-10 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50
        ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}
      `}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm
          transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

// ─── HUD Bottom Toolbar ─────────────────────────────────────

// ─── Drawer Size Presets ─────────────────────────────────

const DRAWER_PRESETS = [
  { name: 'IKEA Alex (wide)', width: 930, depth: 340 },
  { name: 'IKEA Alex (narrow)', width: 332, depth: 340 },
  { name: 'IKEA Helmer', width: 260, depth: 380 },
  { name: 'Milwaukee Packout Drawer', width: 395, depth: 290 },
  { name: 'Harbor Freight (small)', width: 340, depth: 230 },
  { name: 'Harbor Freight (large)', width: 560, depth: 380 },
] as const

function HudToolbar() {
  const { state, actions, meta } = useDrawer()
  const [isExporting, setIsExporting] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const { cellSizeX, cellSizeY } = meta

  const canAddCell =
    state.gridUnitsX > 0 &&
    state.gridUnitsY > 0 &&
    state.cells.length < state.gridUnitsX * state.gridUnitsY

  const exportBaseplate = useCallback(() => {
    setIsExporting(true)
    try {
      const geometry = createBaseplateForDrawer(state.gridUnitsX, state.gridUnitsY, {
        borderRadius: state.borderRadius,
        magnetHoles: state.magnetHoles,
      }, { cellSizeX, cellSizeY })
      const blob = generateSTLBlob(geometry)
      const filename = generateDrawerBaseplateFilename(state.gridUnitsX, state.gridUnitsY)
      downloadBlob(blob, filename)
    } finally {
      setIsExporting(false)
    }
  }, [state.gridUnitsX, state.gridUnitsY, state.borderRadius, state.magnetHoles, cellSizeX, cellSizeY])

  const exportBins = useCallback(() => {
    if (state.cells.length === 0) return
    setIsExporting(true)
    try {
      const geometries = state.cells.map((cell) =>
        createBinForCell(
          cell,
          { heightUnits: state.heightUnits, borderRadius: state.borderRadius },
          { gridUnitsX: state.gridUnitsX, gridUnitsY: state.gridUnitsY, cellSizeX, cellSizeY }
        )
      )
      const merged = mergeGeometriesForExport(geometries)
      if (merged) {
        const blob = generateSTLBlob(merged)
        const filename = `gridfinity-drawer-bins-${state.cells.length}.stl`
        downloadBlob(blob, filename)
      }
    } finally {
      setIsExporting(false)
    }
  }, [state.cells, state.heightUnits, state.borderRadius, state.gridUnitsX, state.gridUnitsY, cellSizeX, cellSizeY])

  return (
    <nav
      aria-label="Drawer controls"
      className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-auto"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 py-2 px-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl max-w-full">
        {/* 0. Undo / Redo */}
        <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => actions.undo()}
                disabled={!meta.canUndo}
                aria-label="Undo"
                className="h-7 w-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => actions.redo()}
                disabled={!meta.canRedo}
                aria-label="Redo"
                className="h-7 w-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>

        {/* 1. Drawer Dimensions + Presets */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
              <Ruler className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
              <input
                type="number"
                value={state.drawerWidthMm}
                min={1}
                onChange={(e) => actions.setDrawerSize(Number(e.target.value), state.drawerDepthMm)}
                aria-label="Drawer width (mm)"
                className="w-14 h-7 px-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 text-center tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
              <span className="text-xs text-zinc-500">&times;</span>
              <input
                type="number"
                value={state.drawerDepthMm}
                min={1}
                onChange={(e) => actions.setDrawerSize(state.drawerWidthMm, Number(e.target.value))}
                aria-label="Drawer depth (mm)"
                className="w-14 h-7 px-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 text-center tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
              <span className="text-xs text-zinc-400">mm</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Drawer Dimensions</TooltipContent>
        </Tooltip>

        {/* Preset Drawer Sizes */}
        <Popover open={presetsOpen} onOpenChange={setPresetsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  aria-label="Drawer Size Presets"
                  className="h-9 w-9 flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <LayoutTemplate className="w-4 h-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Drawer Presets</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="w-64 p-0 bg-zinc-900 border-zinc-700/50 rounded-lg shadow-xl"
          >
            <div className="p-2">
              <p className="px-2 py-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">Drawer Presets</p>
              {DRAWER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    actions.setDrawerSize(preset.width, preset.depth)
                    setPresetsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
                >
                  <span>{preset.name}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{preset.width} &times; {preset.depth}</span>
                </button>
              ))}
              <button
                onClick={() => setPresetsOpen(false)}
                className="w-full flex items-center px-2 py-1.5 rounded-md text-sm text-zinc-400 hover:bg-zinc-800 transition-colors text-left mt-0.5 border-t border-zinc-800"
              >
                Custom
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* 2. Grid */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
              <Grid3x3 className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
              <Stepper
                value={state.gridUnitsX}
                onDecrement={() => actions.setGridUnits(state.gridUnitsX - 1, state.gridUnitsY)}
                onIncrement={() => actions.setGridUnits(state.gridUnitsX + 1, state.gridUnitsY)}
                disableDecrement={state.gridUnitsX <= LIMITS.GRID_MIN}
                disableIncrement={state.gridUnitsX >= LIMITS.GRID_MAX}
                title="Grid X"
              />
              <span className="text-xs text-zinc-500">&times;</span>
              <Stepper
                value={state.gridUnitsY}
                onDecrement={() => actions.setGridUnits(state.gridUnitsX, state.gridUnitsY - 1)}
                onIncrement={() => actions.setGridUnits(state.gridUnitsX, state.gridUnitsY + 1)}
                disableDecrement={state.gridUnitsY <= LIMITS.GRID_MIN}
                disableIncrement={state.gridUnitsY >= LIMITS.GRID_MAX}
                title="Grid Y"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Grid Size ({Math.round(cellSizeX * 10) / 10} &times; {Math.round(cellSizeY * 10) / 10}mm cells)</TooltipContent>
        </Tooltip>

        {/* 3. Height */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
              <RulerDimensionLine className="w-4 h-4 text-zinc-400 shrink-0 rotate-90" aria-hidden="true" />
              <Stepper
                value={state.heightUnits}
                onDecrement={() => actions.setHeightUnits(state.heightUnits - 1)}
                onIncrement={() => actions.setHeightUnits(state.heightUnits + 1)}
                disableDecrement={state.heightUnits <= LIMITS.HEIGHT_MIN}
                disableIncrement={state.heightUnits >= LIMITS.HEIGHT_MAX}
                suffix="u"
                title={`Height: ${state.heightUnits}u (${state.heightUnits * GRIDFINITY.HEIGHT_UNIT}mm)`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Bin Height ({state.heightUnits * GRIDFINITY.HEIGHT_UNIT}mm)</TooltipContent>
        </Tooltip>

        {/* 4. Border Radius */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
              <SquareRoundCorner className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
              <Stepper
                value={state.borderRadius}
                onDecrement={() => actions.setBorderRadius(Math.max(LIMITS.BORDER_RADIUS_MIN, +(state.borderRadius - 0.5).toFixed(1)))}
                onIncrement={() => actions.setBorderRadius(Math.min(LIMITS.BORDER_RADIUS_MAX, +(state.borderRadius + 0.5).toFixed(1)))}
                disableDecrement={state.borderRadius <= LIMITS.BORDER_RADIUS_MIN}
                disableIncrement={state.borderRadius >= LIMITS.BORDER_RADIUS_MAX}
                suffix="mm"
                title={`Border Radius: ${state.borderRadius}mm`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Corner Radius</TooltipContent>
        </Tooltip>

        {/* 5. Magnet Holes */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
              <Magnet className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
              <ToggleSwitch
                checked={state.magnetHoles}
                onChange={actions.setMagnetHoles}
                label="Magnet Holes"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Magnet Holes</TooltipContent>
        </Tooltip>

        {/* 6. Add / Delete Cell */}
        <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => actions.addCell()}
                disabled={!canAddCell}
                aria-label="Add Cell"
                className="h-7 w-7 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add Cell</TooltipContent>
          </Tooltip>
          {meta.selectedCell && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => actions.deleteCell(meta.selectedCell!.id)}
                  aria-label="Delete Selected Cell"
                  className="h-7 w-7 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete Cell</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* 6b. Bin Divisions (only when cell selected) */}
        {meta.selectedCell && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
                <Grid3x3 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <Stepper
                  value={meta.selectedCell.divisionsX ?? 1}
                  onDecrement={() => actions.setDivisions(meta.selectedCell!.id, (meta.selectedCell!.divisionsX ?? 1) - 1, meta.selectedCell!.divisionsY ?? 1)}
                  onIncrement={() => actions.setDivisions(meta.selectedCell!.id, (meta.selectedCell!.divisionsX ?? 1) + 1, meta.selectedCell!.divisionsY ?? 1)}
                  disableDecrement={(meta.selectedCell.divisionsX ?? 1) <= 1}
                  disableIncrement={(meta.selectedCell.divisionsX ?? 1) >= 6}
                  title="Divisions X"
                />
                <span className="text-xs text-zinc-500">&times;</span>
                <Stepper
                  value={meta.selectedCell.divisionsY ?? 1}
                  onDecrement={() => actions.setDivisions(meta.selectedCell!.id, meta.selectedCell!.divisionsX ?? 1, (meta.selectedCell!.divisionsY ?? 1) - 1)}
                  onIncrement={() => actions.setDivisions(meta.selectedCell!.id, meta.selectedCell!.divisionsX ?? 1, (meta.selectedCell!.divisionsY ?? 1) + 1)}
                  disableDecrement={(meta.selectedCell.divisionsY ?? 1) <= 1}
                  disableIncrement={(meta.selectedCell.divisionsY ?? 1) >= 6}
                  title="Divisions Y"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>Bin Compartments</TooltipContent>
          </Tooltip>
        )}

        {/* 7. Export */}
        <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={exportBaseplate}
                disabled={isExporting || state.gridUnitsX === 0 || state.gridUnitsY === 0}
                aria-label="Export Baseplate"
                className="h-7 flex items-center gap-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-200 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baseplate</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Export Baseplate STL</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={exportBins}
                disabled={isExporting || state.cells.length === 0}
                aria-label="Export All Bins"
                className="h-7 flex items-center gap-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Bins ({state.cells.length})</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Export All Bins STL</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </nav>
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
