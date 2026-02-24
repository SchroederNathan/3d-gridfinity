'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { GridfinityConfig } from '@/lib/gridfinity/constants'
import { DEFAULT_CONFIG, LIMITS, GRIDFINITY } from '@/lib/gridfinity/constants'
import { createGridfinityGeometry } from '@/lib/gridfinity/geometry'
import { exportToSTL } from '@/lib/gridfinity/export-stl'

type GridfinityState = GridfinityConfig

type GridfinityActions = {
  setGridX: (x: number) => void
  setGridY: (y: number) => void
  setHeightUnits: (h: number) => void
  setBorderRadius: (r: number) => void
  setModelType: (type: 'baseplate' | 'bin') => void
  setMagnetHoles: (enabled: boolean) => void
  exportSTL: () => void
}

type GridfinityMeta = {
  isExporting: boolean
  dimensions: {
    width: number
    depth: number
    height: number
  }
}

type GridfinityContextValue = {
  state: GridfinityState
  actions: GridfinityActions
  meta: GridfinityMeta
}

const GridfinityContext = createContext<GridfinityContextValue | null>(null)

export function useGridfinity(): GridfinityContextValue {
  const context = useContext(GridfinityContext)
  if (!context) {
    throw new Error('useGridfinity must be used within a GridfinityProvider')
  }
  return context
}

type GridfinityProviderProps = {
  children: ReactNode
  initialConfig?: Partial<GridfinityConfig>
}

export function GridfinityProvider({ children, initialConfig }: GridfinityProviderProps) {
  const [state, setState] = useState<GridfinityState>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })
  const [isExporting, setIsExporting] = useState(false)

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

  const setGridX = useCallback((x: number) => {
    setState(prev => ({ ...prev, gridX: clamp(x, LIMITS.GRID_MIN, LIMITS.GRID_MAX) }))
  }, [])

  const setGridY = useCallback((y: number) => {
    setState(prev => ({ ...prev, gridY: clamp(y, LIMITS.GRID_MIN, LIMITS.GRID_MAX) }))
  }, [])

  const setHeightUnits = useCallback((h: number) => {
    setState(prev => ({ ...prev, heightUnits: clamp(h, LIMITS.HEIGHT_MIN, LIMITS.HEIGHT_MAX) }))
  }, [])

  const setBorderRadius = useCallback((r: number) => {
    setState(prev => ({ ...prev, borderRadius: clamp(r, LIMITS.BORDER_RADIUS_MIN, LIMITS.BORDER_RADIUS_MAX) }))
  }, [])

  const setModelType = useCallback((type: 'baseplate' | 'bin') => {
    setState(prev => ({ ...prev, modelType: type }))
  }, [])

  const setMagnetHoles = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, magnetHoles: enabled }))
  }, [])

  const exportSTL = useCallback(() => {
    setIsExporting(true)
    try {
      const geometry = createGridfinityGeometry(state)
      exportToSTL(geometry, state)
    } finally {
      setIsExporting(false)
    }
  }, [state])

  const dimensions = useMemo(() => ({
    width: state.gridX * GRIDFINITY.CELL_SIZE,
    depth: state.gridY * GRIDFINITY.CELL_SIZE,
    height: state.heightUnits * GRIDFINITY.HEIGHT_UNIT,
  }), [state.gridX, state.gridY, state.heightUnits])

  const actions = useMemo<GridfinityActions>(() => ({
    setGridX,
    setGridY,
    setHeightUnits,
    setBorderRadius,
    setModelType,
    setMagnetHoles,
    exportSTL,
  }), [setGridX, setGridY, setHeightUnits, setBorderRadius, setModelType, setMagnetHoles, exportSTL])

  const meta = useMemo<GridfinityMeta>(() => ({
    isExporting,
    dimensions,
  }), [isExporting, dimensions])

  const value = useMemo<GridfinityContextValue>(() => ({
    state,
    actions,
    meta,
  }), [state, actions, meta])

  return (
    <GridfinityContext.Provider value={value}>
      {children}
    </GridfinityContext.Provider>
  )
}
