'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { useDrawer } from './DrawerContext'
import { GRIDFINITY } from '@/lib/gridfinity/constants'

// ─── Types & constants ───────────────────────────────────────

type SupportType = 'none' | 'touching' | 'everywhere'

const SUPPORT_OPTIONS: { value: SupportType; label: string }[] = [
  { value: 'none',       label: 'None' },
  { value: 'touching',   label: 'Buildplate' },
  { value: 'everywhere', label: 'Everywhere' },
]

const OVERHEAD = 0.20   // 20% travel/cooling overhead (fixed)
const LINE_WIDTH = 0.4  // mm

// ─── Phase colours ───────────────────────────────────────────

const PHASE_COLORS = {
  perimeters: '#60a5fa', // blue
  infill:     '#34d399', // emerald
  supports:   '#f59e0b', // amber
  overhead:   '#a78bfa', // violet
} as const

// ─── Surface-area helper ─────────────────────────────────────

/**
 * Rough surface area (mm²) of the whole print — outer faces only.
 * Baseplate + all bin outer surfaces.
 */
function estimateSurfaceAreaMm2(
  state: {
    gridUnitsX: number
    gridUnitsY: number
    heightUnits: number
    cells: Array<{ spanX: number; spanY: number }>
  },
  cellSizeX: number,
  cellSizeY: number,
): number {
  const { gridUnitsX, gridUnitsY, heightUnits, cells } = state

  // Baseplate: top + bottom + four edges
  const bpW = gridUnitsX * cellSizeX
  const bpD = gridUnitsY * cellSizeY
  const bpH = GRIDFINITY.BASE_HEIGHT
  const baseplateArea =
    2 * bpW * bpD +              // top & bottom faces
    2 * (bpW + bpD) * bpH        // four side edges

  // Bins
  let binsArea = 0
  for (const cell of cells) {
    const binW = cell.spanX * cellSizeX
    const binD = cell.spanY * cellSizeY
    const binH = heightUnits * GRIDFINITY.HEIGHT_UNIT

    // Outer faces (4 sides + bottom; top is open)
    binsArea +=
      2 * (binW + binD) * binH + // four outer wall faces
      binW * binD                // bottom face
  }

  return baseplateArea + binsArea
}

/**
 * Estimate total shell+infill volume in mm³ (same logic as FilamentEstimator).
 */
function estimateVolumeMm3(
  state: {
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

  const baseplateVol =
    gridUnitsX * cellSizeX * gridUnitsY * cellSizeY * GRIDFINITY.BASE_HEIGHT * 0.8

  let binsVol = 0
  for (const cell of cells) {
    const binW = cell.spanX * cellSizeX
    const binD = cell.spanY * cellSizeY
    const binH = heightUnits * GRIDFINITY.HEIGHT_UNIT
    const wallT = GRIDFINITY.WALL_THICKNESS
    const floorH = GRIDFINITY.BASE_HEIGHT
    const outerVol = binW * binD * binH
    const innerW = Math.max(0, binW - 2 * wallT)
    const innerD = Math.max(0, binD - 2 * wallT)
    const innerH = Math.max(0, binH - floorH)
    const innerVoidVol = innerW * innerD * innerH
    const shellVol = outerVol - innerVoidVol
    const infillVol = innerVoidVol * infillFraction * 0.12
    binsVol += shellVol + infillVol
  }

  return baseplateVol + binsVol
}

// ─── Time formatting ─────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatTimeShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Breakdown bar ───────────────────────────────────────────

type BarSegment = {
  label: string
  seconds: number
  color: string
}

function BreakdownBar({ segments, totalSeconds }: { segments: BarSegment[]; totalSeconds: number }) {
  if (totalSeconds === 0) return null
  return (
    <div className="rounded-md overflow-hidden flex h-2.5" title="Phase breakdown">
      {segments.map((seg) => {
        const pct = (seg.seconds / totalSeconds) * 100
        return (
          <div
            key={seg.label}
            style={{ width: `${pct}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${formatTime(seg.seconds)} (${Math.round(pct)}%)`}
          />
        )
      })}
    </div>
  )
}

// ─── Phase table row ─────────────────────────────────────────

function PhaseRow({
  label,
  seconds,
  total,
  color,
}: {
  label: string
  seconds: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((seconds / total) * 100) : 0
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="flex items-center gap-1.5 text-zinc-400 min-w-0">
        <span
          className="inline-block w-2 h-2 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-zinc-300 tabular-nums shrink-0">
        {formatTime(seconds)}
        <span className="text-zinc-600 ml-1">({pct}%)</span>
      </span>
    </div>
  )
}

// ─── PrintTimeEstimator ──────────────────────────────────────

export function PrintTimeEstimator() {
  const { state, meta } = useDrawer()
  const { cellSizeX, cellSizeY } = meta

  const [open, setOpen]               = useState(true)
  const [layerHeight, setLayerHeight] = useState(0.20)  // mm
  const [printSpeed, setPrintSpeed]   = useState(60)    // mm/s
  const [perimeters, setPerimeters]   = useState(3)
  const [infillPct, setInfillPct]     = useState(20)    // %
  const [support, setSupport]         = useState<SupportType>('none')

  const result = useMemo(() => {
    if (state.gridUnitsX === 0 || state.gridUnitsY === 0) {
      return null
    }

    const infillFraction = infillPct / 100

    // Step 1 – volume
    const totalVolumeMm3 = estimateVolumeMm3(state, cellSizeX, cellSizeY, infillFraction)

    // Step 2 – surface area
    const surfaceAreaMm2 = estimateSurfaceAreaMm2(state, cellSizeX, cellSizeY)

    // Step 3 – perimeter time (perimeters run at 70% of print speed)
    const perimeterLength = surfaceAreaMm2 / layerHeight * perimeters
    const perimeterTime   = perimeterLength / (printSpeed * 0.7)  // seconds

    // Step 4 – infill time
    const infillVolume = totalVolumeMm3 * infillFraction
    const infillLength = infillVolume / (layerHeight * LINE_WIDTH)
    const infillTime   = infillLength / printSpeed  // seconds

    // Step 5 – support time
    let supportTime = 0
    if (support === 'touching')   supportTime = infillTime * 0.15
    if (support === 'everywhere') supportTime = infillTime * 0.35

    // Step 6 – total with overhead
    const rawTime   = perimeterTime + infillTime + supportTime
    const overheadTime = rawTime * OVERHEAD
    const totalTime = rawTime + overheadTime

    return {
      perimeterTime,
      infillTime,
      supportTime,
      overheadTime,
      totalTime,
    }
  }, [
    state, cellSizeX, cellSizeY,
    layerHeight, printSpeed, perimeters, infillPct, support,
  ])

  const segments: BarSegment[] = result
    ? [
        { label: 'Perimeters', seconds: result.perimeterTime, color: PHASE_COLORS.perimeters },
        { label: 'Infill',     seconds: result.infillTime,    color: PHASE_COLORS.infill },
        { label: 'Supports',   seconds: result.supportTime,   color: PHASE_COLORS.supports },
        { label: 'Overhead',   seconds: result.overheadTime,  color: PHASE_COLORS.overhead },
      ]
    : []

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50 transition-colors focus-visible:outline-none"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          Print Time Estimator
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-zinc-700/40">
          {/* ── Controls ── */}
          {/* Layer height */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Layer height
              </p>
              <span className="text-[11px] text-zinc-300 tabular-nums">{layerHeight.toFixed(2)} mm</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.40}
              step={0.05}
              value={layerHeight}
              onChange={(e) => setLayerHeight(Number(e.target.value))}
              className="w-full h-1.5 appearance-none bg-zinc-700 rounded-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
              <span>0.05</span><span>0.40</span>
            </div>
          </div>

          {/* Print speed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Print speed
              </p>
              <span className="text-[11px] text-zinc-300 tabular-nums">{printSpeed} mm/s</span>
            </div>
            <input
              type="range"
              min={30}
              max={120}
              step={5}
              value={printSpeed}
              onChange={(e) => setPrintSpeed(Number(e.target.value))}
              className="w-full h-1.5 appearance-none bg-zinc-700 rounded-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
              <span>30</span><span>120</span>
            </div>
          </div>

          {/* Perimeters */}
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Perimeters
            </p>
            <div className="flex gap-1">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPerimeters(n)}
                  className={`flex-1 py-0.5 text-xs rounded-md transition-colors focus-visible:outline-none ${
                    perimeters === n
                      ? 'bg-sky-600 text-white'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Infill */}
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Infill
            </p>
            <div className="flex gap-1 flex-wrap">
              {[10, 15, 20, 25, 30, 40, 50, 80].map((pct) => (
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

          {/* Support */}
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Supports
            </p>
            <div className="grid grid-cols-3 gap-1">
              {SUPPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSupport(opt.value)}
                  className={`py-0.5 text-[11px] rounded-md transition-colors focus-visible:outline-none ${
                    support === opt.value
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Results ── */}
          <div className="pt-1 border-t border-zinc-700/40 space-y-2">
            {result ? (
              <>
                {/* Big time display */}
                <div className="text-center py-1">
                  <span className="text-2xl font-bold tabular-nums text-sky-300">
                    {formatTimeShort(result.totalTime)}
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">estimated print time</p>
                </div>

                {/* Phase bar */}
                <BreakdownBar segments={segments} totalSeconds={result.totalTime} />

                {/* Phase legend / table */}
                <div className="space-y-1 pt-0.5">
                  <PhaseRow
                    label="Perimeters"
                    seconds={result.perimeterTime}
                    total={result.totalTime}
                    color={PHASE_COLORS.perimeters}
                  />
                  <PhaseRow
                    label="Infill"
                    seconds={result.infillTime}
                    total={result.totalTime}
                    color={PHASE_COLORS.infill}
                  />
                  {result.supportTime > 0 && (
                    <PhaseRow
                      label="Supports"
                      seconds={result.supportTime}
                      total={result.totalTime}
                      color={PHASE_COLORS.supports}
                    />
                  )}
                  <PhaseRow
                    label="Travel/cooling"
                    seconds={result.overheadTime}
                    total={result.totalTime}
                    color={PHASE_COLORS.overhead}
                  />
                </div>

                {/* Disclaimer */}
                <p className="text-[9px] text-zinc-600 italic text-center pt-1 border-t border-zinc-700/30">
                  Estimated — actual print time may vary ±30%
                </p>
              </>
            ) : (
              <p className="text-[10px] text-zinc-600 italic text-center pt-1">
                Set drawer dimensions to estimate
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
