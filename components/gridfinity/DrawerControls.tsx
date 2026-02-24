'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDrawer } from './DrawerContext'
import { LIMITS, GRIDFINITY } from '@/lib/gridfinity/constants'
import {
  createBaseplateForDrawer,
  createBinForCell,
} from '@/lib/gridfinity/geometry'
import {
  generateSTLBlob,
  downloadBlob,
  generateDrawerBaseplateFilename,
  mergeGeometriesForExport,
} from '@/lib/gridfinity/export-stl'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  unit?: string
}

function Slider({ label, value, min, max, step = 1, onChange, unit }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <span className="text-sm text-zinc-500 tabular-nums">
          {value}{unit && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  )
}

type NumberInputProps = {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  unit?: string
}

function NumberInput({ label, value, min = 0, max, onChange, unit }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value))

  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  const handleBlur = useCallback(() => {
    let num = parseFloat(localValue)
    if (isNaN(num)) num = min
    if (max !== undefined) num = Math.min(num, max)
    num = Math.max(num, min)
    setLocalValue(String(num))
    onChange(num)
  }, [localValue, min, max, onChange])

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={localValue}
          min={min}
          max={max}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        />
        {unit && <span className="text-sm text-zinc-500 shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

function DrawerSize() {
  const { state, actions } = useDrawer()

  const handleWidthChange = useCallback(
    (width: number) => {
      actions.setDrawerSize(width, state.drawerDepthMm)
    },
    [actions, state.drawerDepthMm]
  )

  const handleDepthChange = useCallback(
    (depth: number) => {
      actions.setDrawerSize(state.drawerWidthMm, depth)
    },
    [actions, state.drawerWidthMm]
  )

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Drawer Dimensions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Width"
          value={state.drawerWidthMm}
          min={GRIDFINITY.CELL_SIZE}
          onChange={handleWidthChange}
          unit="mm"
        />
        <NumberInput
          label="Depth"
          value={state.drawerDepthMm}
          min={GRIDFINITY.CELL_SIZE}
          onChange={handleDepthChange}
          unit="mm"
        />
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <span className="text-sm text-zinc-400">Grid Size</span>
        <span className="text-sm font-medium text-zinc-200">
          {state.gridUnitsX} x {state.gridUnitsY} units
        </span>
      </div>
    </div>
  )
}

function CellHeight() {
  const { state, actions } = useDrawer()

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Bin Height
      </h3>
      <Slider
        label="Height Units"
        value={state.heightUnits}
        min={LIMITS.HEIGHT_MIN}
        max={LIMITS.HEIGHT_MAX}
        onChange={actions.setHeightUnits}
        unit={`(${state.heightUnits * GRIDFINITY.HEIGHT_UNIT}mm)`}
      />
    </div>
  )
}

function BorderRadius() {
  const { state, actions } = useDrawer()

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Corner Radius
      </h3>
      <Slider
        label="Border Radius"
        value={state.borderRadius}
        min={LIMITS.BORDER_RADIUS_MIN}
        max={LIMITS.BORDER_RADIUS_MAX}
        step={0.1}
        onChange={actions.setBorderRadius}
        unit="mm"
      />
    </div>
  )
}

function MagnetHoles() {
  const { state, actions } = useDrawer()

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Baseplate Options
      </h3>
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={state.magnetHoles}
            onChange={(e) => actions.setMagnetHoles(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-5 h-5 bg-zinc-800 border border-zinc-600 rounded peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors" />
          <svg
            className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
          Magnet Holes ({GRIDFINITY.MAGNET_HOLE_DIAMETER}mm)
        </span>
      </label>
    </div>
  )
}

function CellActions() {
  const { state, actions, meta } = useDrawer()

  const canAddCell =
    state.gridUnitsX > 0 &&
    state.gridUnitsY > 0 &&
    state.cells.length < state.gridUnitsX * state.gridUnitsY

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Layout
      </h3>
      <div className="flex gap-2">
        <button
          onClick={() => actions.addCell()}
          disabled={!canAddCell}
          className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Cell
        </button>
        <button
          onClick={() => actions.clearCells()}
          disabled={state.cells.length === 0}
          className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          Clear
        </button>
      </div>
      {meta.selectedCell && (
        <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-zinc-200">
              Selected: {meta.selectedCell.spanX}x{meta.selectedCell.spanY}
            </span>
            <button
              onClick={() => actions.deleteCell(meta.selectedCell!.id)}
              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors"
            >
              Delete
            </button>
          </div>
          <div className="text-xs text-zinc-500">
            Position: ({meta.selectedCell.gridX}, {meta.selectedCell.gridY})
          </div>
        </div>
      )}
    </div>
  )
}

function Export() {
  const { state } = useDrawer()
  const [isExporting, setIsExporting] = useState(false)

  const exportBaseplate = useCallback(() => {
    setIsExporting(true)
    try {
      const geometry = createBaseplateForDrawer(state.gridUnitsX, state.gridUnitsY, {
        borderRadius: state.borderRadius,
        magnetHoles: state.magnetHoles,
      })
      const blob = generateSTLBlob(geometry)
      const filename = generateDrawerBaseplateFilename(state.gridUnitsX, state.gridUnitsY)
      downloadBlob(blob, filename)
    } finally {
      setIsExporting(false)
    }
  }, [state.gridUnitsX, state.gridUnitsY, state.borderRadius, state.magnetHoles])

  const exportBins = useCallback(() => {
    if (state.cells.length === 0) return
    setIsExporting(true)
    try {
      const geometries = state.cells.map((cell) =>
        createBinForCell(
          cell,
          { heightUnits: state.heightUnits, borderRadius: state.borderRadius },
          { gridUnitsX: state.gridUnitsX, gridUnitsY: state.gridUnitsY }
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
  }, [state.cells, state.heightUnits, state.borderRadius, state.gridUnitsX, state.gridUnitsY])

  const hasCells = state.cells.length > 0

  return (
    <div className="space-y-2">
      <button
        onClick={exportBaseplate}
        disabled={isExporting || state.gridUnitsX === 0 || state.gridUnitsY === 0}
        className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 text-zinc-200 text-sm font-medium rounded-lg border border-zinc-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export Baseplate
      </button>
      <button
        onClick={exportBins}
        disabled={isExporting || !hasCells}
        className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export All Bins ({state.cells.length})
      </button>
    </div>
  )
}

function Summary() {
  const { state } = useDrawer()

  const totalCells = state.cells.reduce((acc, cell) => acc + cell.spanX * cell.spanY, 0)
  const gridCells = state.gridUnitsX * state.gridUnitsY
  const coverage = gridCells > 0 ? Math.round((totalCells / gridCells) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <div className="text-lg font-semibold text-zinc-100">{state.cells.length}</div>
        <div className="text-xs text-zinc-500">Bins</div>
      </div>
      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <div className="text-lg font-semibold text-zinc-100">{coverage}%</div>
        <div className="text-xs text-zinc-500">Coverage</div>
      </div>
      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <div className="text-lg font-semibold text-zinc-100">
          {state.gridUnitsX}x{state.gridUnitsY}
        </div>
        <div className="text-xs text-zinc-500">Grid</div>
      </div>
      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <div className="text-lg font-semibold text-zinc-100">
          {state.heightUnits * GRIDFINITY.HEIGHT_UNIT}
        </div>
        <div className="text-xs text-zinc-500">Height (mm)</div>
      </div>
    </div>
  )
}

export const DrawerControls = {
  DrawerSize,
  CellHeight,
  BorderRadius,
  MagnetHoles,
  CellActions,
  Export,
  Summary,
}
