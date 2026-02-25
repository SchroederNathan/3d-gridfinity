'use client'

import { useState, useCallback } from 'react'
import {
  Plus,
  Minus,
  Download,
  Grid3x3,
  Trash2,
  Layers,
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
import { GRIDFINITY, LIMITS } from '@/lib/gridfinity/constants'
import {
  generateSTLBlob,
  downloadBlob,
  generateDrawerBaseplateFilename,
  mergeGeometriesForExport,
} from '@/lib/gridfinity/export-stl'

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

// ─── Drawer Size Presets ─────────────────────────────────

const DRAWER_PRESETS = [
  { name: 'IKEA Alex (wide)', width: 930, depth: 340 },
  { name: 'IKEA Alex (narrow)', width: 332, depth: 340 },
  { name: 'IKEA Helmer', width: 260, depth: 380 },
  { name: 'Milwaukee Packout Drawer', width: 395, depth: 290 },
  { name: 'Harbor Freight (small)', width: 340, depth: 230 },
  { name: 'Harbor Freight (large)', width: 560, depth: 380 },
] as const

// ─── Sub-components ──────────────────────────────────────

function UndoRedoGroup() {
  const { actions, meta } = useDrawer()
  return (
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
  )
}

function DrawerDimensionsGroup() {
  const { state, actions } = useDrawer()
  const [presetsOpen, setPresetsOpen] = useState(false)

  return (
    <>
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
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

function GridSizeGroup() {
  const { state, actions, meta } = useDrawer()
  const { cellSizeX, cellSizeY } = meta
  return (
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
  )
}

function HeightGroup() {
  const { state, actions } = useDrawer()
  return (
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
  )
}

function BorderRadiusGroup() {
  const { state, actions } = useDrawer()
  return (
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
  )
}

function CellActionsGroup() {
  const { state, actions, meta } = useDrawer()

  const canAddCell =
    state.gridUnitsX > 0 &&
    state.gridUnitsY > 0 &&
    state.cells.length < state.gridUnitsX * state.gridUnitsY

  return (
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
  )
}

function SelectedCellControls() {
  const { actions, meta } = useDrawer()
  if (!meta.selectedCell) return null
  const cell = meta.selectedCell

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
            <Grid3x3 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <Stepper
              value={cell.divisionsX ?? 1}
              onDecrement={() => actions.setDivisions(cell.id, (cell.divisionsX ?? 1) - 1, cell.divisionsY ?? 1)}
              onIncrement={() => actions.setDivisions(cell.id, (cell.divisionsX ?? 1) + 1, cell.divisionsY ?? 1)}
              disableDecrement={(cell.divisionsX ?? 1) <= 1}
              disableIncrement={(cell.divisionsX ?? 1) >= 6}
              title="Divisions X"
            />
            <span className="text-xs text-zinc-500">&times;</span>
            <Stepper
              value={cell.divisionsY ?? 1}
              onDecrement={() => actions.setDivisions(cell.id, cell.divisionsX ?? 1, (cell.divisionsY ?? 1) - 1)}
              onIncrement={() => actions.setDivisions(cell.id, cell.divisionsX ?? 1, (cell.divisionsY ?? 1) + 1)}
              disableDecrement={(cell.divisionsY ?? 1) <= 1}
              disableIncrement={(cell.divisionsY ?? 1) >= 6}
              title="Divisions Y"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>Bin Compartments</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-800/50 rounded-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => actions.setStackingLip(cell.id, !(cell.stackingLip !== false))}
              aria-label="Toggle Stacking Lip"
              className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                cell.stackingLip !== false
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Stacking Lip {cell.stackingLip !== false ? '(on)' : '(off)'}</TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}

function ExportGroup() {
  const { state, meta } = useDrawer()
  const [isExporting, setIsExporting] = useState(false)
  const { cellSizeX, cellSizeY } = meta

  const exportBaseplate = useCallback(() => {
    setIsExporting(true)
    try {
      const geometry = createBaseplateForDrawer(state.gridUnitsX, state.gridUnitsY, {
        borderRadius: state.borderRadius,
      }, { cellSizeX, cellSizeY })
      const blob = generateSTLBlob(geometry)
      const filename = generateDrawerBaseplateFilename(state.gridUnitsX, state.gridUnitsY)
      downloadBlob(blob, filename)
    } finally {
      setIsExporting(false)
    }
  }, [state.gridUnitsX, state.gridUnitsY, state.borderRadius, cellSizeX, cellSizeY])

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
  )
}

// ─── Main HudToolbar ─────────────────────────────────────

export function HudToolbar() {
  return (
    <nav
      aria-label="Drawer controls"
      className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-auto"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 py-2 px-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl max-w-full">
        <UndoRedoGroup />
        <DrawerDimensionsGroup />
        <GridSizeGroup />
        <HeightGroup />
        <BorderRadiusGroup />
        <CellActionsGroup />
        <SelectedCellControls />
        <ExportGroup />
      </div>
    </nav>
  )
}
