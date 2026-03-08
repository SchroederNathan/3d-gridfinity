'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Flame } from 'lucide-react'
import { useDrawer } from './DrawerContext'
import { GRIDFINITY } from '@/lib/gridfinity/constants'

// ─── Material profiles ───────────────────────────────────────

type Material = {
  label: string
  density: number // g/cm³
  color: string
}

const MATERIALS: Material[] = [
  { label: 'PLA',  density: 1.24, color: '#34d399' },
  { label: 'PETG', density: 1.27, color: '#60a5fa' },
  { label: 'ABS',  density: 1.05, color: '#f59e0b' },
  { label: 'TPU',  density: 1.21, color: '#c084fc' },
]

const INFILL_PRESETS = [15, 20, 25, 30, 40, 50]

// ─── Volume estimation ───────────────────────────────────────

/**
 * Estimate total filament volume in mm³.
 *
 * Baseplate: mostly solid waffle plate — approximate as 80% of bounding box
 * Bins: shell walls + base only; infill applies to the per-bin solid base layer
 */
function estimateVolumeMm3(
  state: {
    drawerWidthMm: number
    drawerDepthMm: number
    gridUnitsX: number
    gridUnitsY: number
    heightUnits: number
    cells: Array<{ spanX: number; spanY: number }>
  },
  cellSizeX: number,
  cellSizeY: number,
  infillFraction: number,
): number {
  const { gridUnitsX, gridUnitsY, heightUnits, cells } = state

  // Baseplate (waffle grid — roughly 80% solid)
  const baseplateWidth = gridUnitsX * cellSizeX
  const baseplateDepth = gridUnitsY * cellSizeY
  const baseplateVol = baseplateWidth * baseplateDepth * GRIDFINITY.BASE_HEIGHT * 0.8

  // Bin walls + floor
  let binsVol = 0
  for (const cell of cells) {
    const binW = cell.spanX * cellSizeX
    const binD = cell.spanY * cellSizeY
    const binH = heightUnits * GRIDFINITY.HEIGHT_UNIT

    const wallT = GRIDFINITY.WALL_THICKNESS
    const floorH = GRIDFINITY.BASE_HEIGHT // use base height as approx floor thickness

    // Outer bounding box
    const outerVol = binW * binD * binH

    // Inner void (inside the walls and above the floor)
    const innerW = Math.max(0, binW - 2 * wallT)
    const innerD = Math.max(0, binD - 2 * wallT)
    const innerH = Math.max(0, binH - floorH)
    const innerVoidVol = innerW * innerD * innerH

    // Shell volume (walls + floor)
    const shellVol = outerVol - innerVoidVol

    // Add infill contribution to the inner void (small for normal infill values)
    const infillVol = innerVoidVol * infillFraction * 0.12 // infill doesn't fill the entire space

    binsVol += shellVol + infillVol
  }

  return baseplateVol + binsVol
}

// ─── FilamentEstimator ───────────────────────────────────────

export function FilamentEstimator() {
  const { state, meta } = useDrawer()
  const [open, setOpen] = useState(true)
  const [materialIdx, setMaterialIdx] = useState(0)
  const [pricePerKg, setPricePerKg] = useState(22)
  const [infillPct, setInfillPct] = useState(20)

  const { cellSizeX, cellSizeY } = meta
  const material = MATERIALS[materialIdx]

  const { weightG, costDollar, baseplateG, binsG } = useMemo(() => {
    if (state.gridUnitsX === 0 || state.gridUnitsY === 0) {
      return { weightG: 0, costDollar: 0, baseplateG: 0, binsG: 0 }
    }

    // Baseplate only
    const baseplateVol =
      state.gridUnitsX * cellSizeX * state.gridUnitsY * cellSizeY * GRIDFINITY.BASE_HEIGHT * 0.8
    const baseplateGrams = (baseplateVol / 1000) * material.density

    // Bins
    let binsVol = 0
    for (const cell of state.cells) {
      const binW = cell.spanX * cellSizeX
      const binD = cell.spanY * cellSizeY
      const binH = state.heightUnits * GRIDFINITY.HEIGHT_UNIT
      const wallT = GRIDFINITY.WALL_THICKNESS
      const floorH = GRIDFINITY.BASE_HEIGHT
      const outerVol = binW * binD * binH
      const innerW = Math.max(0, binW - 2 * wallT)
      const innerD = Math.max(0, binD - 2 * wallT)
      const innerH = Math.max(0, binH - floorH)
      const innerVoidVol = innerW * innerD * innerH
      const shellVol = outerVol - innerVoidVol
      const infillVol = innerVoidVol * (infillPct / 100) * 0.12
      binsVol += shellVol + infillVol
    }
    const binsGrams = (binsVol / 1000) * material.density

    const totalG = baseplateGrams + binsGrams
    const cost = (totalG / 1000) * pricePerKg

    return {
      weightG: Math.round(totalG * 10) / 10,
      costDollar: Math.round(cost * 100) / 100,
      baseplateG: Math.round(baseplateGrams * 10) / 10,
      binsG: Math.round(binsGrams * 10) / 10,
    }
  }, [state, cellSizeX, cellSizeY, material, pricePerKg, infillPct])

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50 transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Filament Estimator
          </span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 space-y-3 border-t border-zinc-700/40">
            {/* Material selector */}
            <div className="pt-2">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                Material
              </p>
              <div className="grid grid-cols-4 gap-1">
                {MATERIALS.map((mat, i) => (
                  <button
                    key={mat.label}
                    onClick={() => setMaterialIdx(i)}
                    className={`py-1 text-xs font-medium rounded-md transition-colors focus-visible:outline-none ${
                      materialIdx === i
                        ? 'bg-zinc-700 text-white'
                        : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                    style={materialIdx === i ? { color: mat.color } : undefined}
                  >
                    {mat.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                Density: {material.density} g/cm³
              </p>
            </div>

            {/* Price per kg */}
            <div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                Price / kg
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400">$</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(Math.max(1, Number(e.target.value)))}
                  className="w-full h-7 px-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 text-center tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                />
                <span className="text-xs text-zinc-400">/kg</span>
              </div>
            </div>

            {/* Infill */}
            <div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                Infill
              </p>
              <div className="flex gap-1 flex-wrap">
                {INFILL_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setInfillPct(pct)}
                    className={`px-1.5 py-0.5 text-xs rounded-md transition-colors focus-visible:outline-none ${
                      infillPct === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            <div className="pt-1 border-t border-zinc-700/40 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Baseplate</span>
                <span className="text-zinc-300 tabular-nums">{baseplateG}g</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">
                  Bins ({state.cells.length})
                </span>
                <span className="text-zinc-300 tabular-nums">{binsG}g</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-zinc-700/40">
                <span className="text-zinc-200">Total</span>
                <span className="text-emerald-400 tabular-nums">{weightG}g</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-zinc-200">Cost</span>
                <span
                  className="tabular-nums"
                  style={{ color: material.color }}
                >
                  ${costDollar.toFixed(2)}
                </span>
              </div>
              {state.cells.length === 0 && (
                <p className="text-[10px] text-zinc-600 italic text-center pt-1">
                  Add bins to estimate total
                </p>
              )}
            </div>
          </div>
        )}
      </div>
  )
}
