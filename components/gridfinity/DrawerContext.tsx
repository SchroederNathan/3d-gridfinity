'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { LIMITS } from '@/lib/gridfinity/constants'
import {
  canPlaceCell,
  canResize,
  findLargestEmpty,
  type LayoutCell,
} from '@/lib/gridfinity/layout'

type DrawerLayoutState = {
  drawerWidthMm: number
  drawerDepthMm: number
  gridUnitsX: number
  gridUnitsY: number
  heightUnits: number
  borderRadius: number
  magnetHoles: boolean
  cells: LayoutCell[]
  selectedCellId: string | null
}

type DrawerActions = {
  setDrawerSize: (widthMm: number, depthMm: number) => void
  setGridUnits: (gridX: number, gridY: number) => void
  setHeightUnits: (h: number) => void
  setBorderRadius: (r: number) => void
  setMagnetHoles: (enabled: boolean) => void
  addCell: () => LayoutCell | null
  resizeCell: (cellId: string, spanX: number, spanY: number) => boolean
  moveCell: (cellId: string, gridX: number, gridY: number) => boolean
  deleteCell: (cellId: string) => void
  selectCell: (cellId: string | null) => void
  clearCells: () => void
}

type DrawerMeta = {
  isExporting: boolean
  selectedCell: LayoutCell | null
  cellSizeX: number
  cellSizeY: number
}

type DrawerContextValue = {
  state: DrawerLayoutState
  actions: DrawerActions
  meta: DrawerMeta
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawer(): DrawerContextValue {
  const context = useContext(DrawerContext)
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider')
  }
  return context
}

const DEFAULT_DRAWER_STATE: DrawerLayoutState = {
  drawerWidthMm: 210,
  drawerDepthMm: 168,
  gridUnitsX: 5,
  gridUnitsY: 4,
  heightUnits: 3,
  borderRadius: 0.8,
  magnetHoles: false,
  cells: [],
  selectedCellId: null,
}

type DrawerProviderProps = {
  children: ReactNode
  initialState?: Partial<DrawerLayoutState>
}

let cellIdCounter = 0
function generateCellId(): string {
  return `cell-${++cellIdCounter}`
}

export function DrawerProvider({ children, initialState }: DrawerProviderProps) {
  const [state, setState] = useState<DrawerLayoutState>(() => ({
    ...DEFAULT_DRAWER_STATE,
    ...initialState,
  }))
  const [isExporting, setIsExporting] = useState(false)

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))

  const setDrawerSize = useCallback((widthMm: number, depthMm: number) => {
    setState((prev) => {
      // Keep current grid units — cell sizes adjust automatically
      const validCells = prev.cells.filter(
        (cell) =>
          cell.gridX + cell.spanX <= prev.gridUnitsX &&
          cell.gridY + cell.spanY <= prev.gridUnitsY
      )
      return {
        ...prev,
        drawerWidthMm: Math.max(1, widthMm),
        drawerDepthMm: Math.max(1, depthMm),
        cells: validCells,
        selectedCellId: validCells.find((c) => c.id === prev.selectedCellId)
          ? prev.selectedCellId
          : null,
      }
    })
  }, [])

  const setGridUnits = useCallback((gridX: number, gridY: number) => {
    setState((prev) => {
      // Only clamp to LIMITS — no drawer-size-based cap (cells stretch to fit)
      const clampedX = clamp(gridX, LIMITS.GRID_MIN, LIMITS.GRID_MAX)
      const clampedY = clamp(gridY, LIMITS.GRID_MIN, LIMITS.GRID_MAX)
      const validCells = prev.cells.filter(
        (cell) =>
          cell.gridX + cell.spanX <= clampedX &&
          cell.gridY + cell.spanY <= clampedY
      )
      return {
        ...prev,
        gridUnitsX: clampedX,
        gridUnitsY: clampedY,
        cells: validCells,
        selectedCellId: validCells.find((c) => c.id === prev.selectedCellId)
          ? prev.selectedCellId
          : null,
      }
    })
  }, [])

  const setHeightUnits = useCallback((h: number) => {
    setState((prev) => ({
      ...prev,
      heightUnits: clamp(h, LIMITS.HEIGHT_MIN, LIMITS.HEIGHT_MAX),
    }))
  }, [])

  const setBorderRadius = useCallback((r: number) => {
    setState((prev) => ({
      ...prev,
      borderRadius: clamp(r, LIMITS.BORDER_RADIUS_MIN, LIMITS.BORDER_RADIUS_MAX),
    }))
  }, [])

  const setMagnetHoles = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, magnetHoles: enabled }))
  }, [])

  const addCell = useCallback((): LayoutCell | null => {
    let newCell: LayoutCell | null = null
    setState((prev) => {
      const empty = findLargestEmpty(prev.cells, prev.gridUnitsX, prev.gridUnitsY)
      if (!empty) {
        return prev
      }
      newCell = {
        id: generateCellId(),
        gridX: empty.x,
        gridY: empty.y,
        spanX: empty.spanX,
        spanY: empty.spanY,
      }
      return {
        ...prev,
        cells: [...prev.cells, newCell],
        selectedCellId: newCell.id,
      }
    })
    return newCell
  }, [])

  const resizeCell = useCallback(
    (cellId: string, spanX: number, spanY: number): boolean => {
      let success = false
      setState((prev) => {
        if (!canResize(prev.cells, cellId, spanX, spanY, prev.gridUnitsX, prev.gridUnitsY)) {
          return prev
        }
        success = true
        return {
          ...prev,
          cells: prev.cells.map((cell) =>
            cell.id === cellId ? { ...cell, spanX, spanY } : cell
          ),
        }
      })
      return success
    },
    []
  )

  const moveCell = useCallback(
    (cellId: string, gridX: number, gridY: number): boolean => {
      let success = false
      setState((prev) => {
        const cell = prev.cells.find((c) => c.id === cellId)
        if (!cell) return prev

        const movedCell: LayoutCell = { ...cell, gridX, gridY }
        const otherCells = prev.cells.filter((c) => c.id !== cellId)

        if (!canPlaceCell(otherCells, movedCell, prev.gridUnitsX, prev.gridUnitsY)) {
          return prev
        }

        success = true
        return {
          ...prev,
          cells: prev.cells.map((c) => (c.id === cellId ? movedCell : c)),
        }
      })
      return success
    },
    []
  )

  const deleteCell = useCallback((cellId: string) => {
    setState((prev) => ({
      ...prev,
      cells: prev.cells.filter((c) => c.id !== cellId),
      selectedCellId: prev.selectedCellId === cellId ? null : prev.selectedCellId,
    }))
  }, [])

  const selectCell = useCallback((cellId: string | null) => {
    setState((prev) => ({ ...prev, selectedCellId: cellId }))
  }, [])

  const clearCells = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cells: [],
      selectedCellId: null,
    }))
  }, [])

  const selectedCell = useMemo(
    () => state.cells.find((c) => c.id === state.selectedCellId) ?? null,
    [state.cells, state.selectedCellId]
  )

  const cellSizeX = state.drawerWidthMm / state.gridUnitsX
  const cellSizeY = state.drawerDepthMm / state.gridUnitsY

  const actions = useMemo<DrawerActions>(
    () => ({
      setDrawerSize,
      setGridUnits,
      setHeightUnits,
      setBorderRadius,
      setMagnetHoles,
      addCell,
      resizeCell,
      moveCell,
      deleteCell,
      selectCell,
      clearCells,
    }),
    [
      setDrawerSize,
      setGridUnits,
      setHeightUnits,
      setBorderRadius,
      setMagnetHoles,
      addCell,
      resizeCell,
      moveCell,
      deleteCell,
      selectCell,
      clearCells,
    ]
  )

  const meta = useMemo<DrawerMeta>(
    () => ({
      isExporting,
      selectedCell,
      cellSizeX,
      cellSizeY,
    }),
    [isExporting, selectedCell, cellSizeX, cellSizeY]
  )

  const value = useMemo<DrawerContextValue>(
    () => ({
      state,
      actions,
      meta,
    }),
    [state, actions, meta]
  )

  return (
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  )
}
