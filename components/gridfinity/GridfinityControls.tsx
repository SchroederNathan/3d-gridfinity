'use client'

import { useGridfinity } from './GridfinityContext'
import { LIMITS, GRIDFINITY } from '@/lib/gridfinity/constants'

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
        <label className="text-sm font-medium text-neutral-700">{label}</label>
        <span className="text-sm text-neutral-500 tabular-nums">
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
        className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  )
}

function GridSize() {
  const { state, actions } = useGridfinity()

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Grid Size</h3>
      <Slider
        label="Width (X)"
        value={state.gridX}
        min={LIMITS.GRID_MIN}
        max={20}
        onChange={actions.setGridX}
        unit="cells"
      />
      <Slider
        label="Depth (Y)"
        value={state.gridY}
        min={LIMITS.GRID_MIN}
        max={20}
        onChange={actions.setGridY}
        unit="cells"
      />
    </div>
  )
}

function CellHeight() {
  const { state, actions } = useGridfinity()

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Height</h3>
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
  const { state, actions } = useGridfinity()

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Corner Radius</h3>
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

function ModelType() {
  const { state, actions } = useGridfinity()

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Model Type</h3>
      <div className="flex gap-2">
        <button
          onClick={() => actions.setModelType('bin')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            state.modelType === 'bin'
              ? 'bg-blue-500 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Bin
        </button>
        <button
          onClick={() => actions.setModelType('baseplate')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            state.modelType === 'baseplate'
              ? 'bg-blue-500 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Baseplate
        </button>
      </div>
    </div>
  )
}

function MagnetHoles() {
  const { state, actions } = useGridfinity()

  if (state.modelType !== 'baseplate') return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Options</h3>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={state.magnetHoles}
          onChange={(e) => actions.setMagnetHoles(e.target.checked)}
          className="w-4 h-4 text-blue-500 rounded border-neutral-300 focus:ring-blue-500"
        />
        <span className="text-sm text-neutral-700">
          Magnet Holes ({GRIDFINITY.MAGNET_HOLE_DIAMETER}mm)
        </span>
      </label>
    </div>
  )
}

function Export() {
  const { actions, meta } = useGridfinity()

  return (
    <button
      onClick={actions.exportSTL}
      disabled={meta.isExporting}
      className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      {meta.isExporting ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export STL
        </>
      )}
    </button>
  )
}

function Dimensions() {
  const { meta } = useGridfinity()

  return (
    <div className="p-3 bg-neutral-50 rounded-lg">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Dimensions</h4>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold text-neutral-800">{meta.dimensions.width}</div>
          <div className="text-xs text-neutral-500">W (mm)</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-neutral-800">{meta.dimensions.depth}</div>
          <div className="text-xs text-neutral-500">D (mm)</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-neutral-800">{meta.dimensions.height}</div>
          <div className="text-xs text-neutral-500">H (mm)</div>
        </div>
      </div>
    </div>
  )
}

export const GridfinityControls = {
  GridSize,
  CellHeight,
  BorderRadius,
  ModelType,
  MagnetHoles,
  Export,
  Dimensions,
}
