'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
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
  setDivisions: (cellId: string, divisionsX: number, divisionsY: number) => void
  undo: () => void
  redo: () => void
}

type DrawerMeta = {
  isExporting: boolean
  selectedCell: LayoutCell | null
  cellSizeX: number
  cellSizeY: number
  canUndo: boolean
  canRedo: boolean
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

const MAX_HISTORY = 50

let cellIdCounter = 0
function generateCellId(): string {
  return `cell-${++cellIdCounter}`
}

/** Compare states ignoring selectedCellId (selection isn't an undoable mutation) */
function statesEqual(a: DrawerLayoutState, b: DrawerLayoutState): boolean {
  return (
    a.drawerWidthMm === b.drawerWidthMm &&
    a.drawerDepthMm === b.drawerDepthMm &&
    a.gridUnitsX === b.gridUnitsX &&
    a.gridUnitsY === b.gridUnitsY &&
    a.heightUnits === b.heightUnits &&
    a.borderRadius === b.borderRadius &&
    a.magnetHoles === b.magnetHoles &&
    a.cells === b.cells
  )
}

export function DrawerProvider({ children, initialState }: DrawerProviderProps) {
  const [state, setStateRaw] = useState<DrawerLayoutState>(() => ({
    ...DEFAULT_DRAWER_STATE,
    ...initialState,
  }))
  const [isExporting, setIsExporting] = useState(false)

  // ─── Undo/Redo History ──────────────────────────────────
  const historyRef = useRef<DrawerLayoutState[]>([])
  const futureRef = useRef<DrawerLayoutState[]>([])

  /** setState wrapper that pushes to history for undoable mutations */
  const setState = useCallback(
    (updater: (prev: DrawerLayoutState) => DrawerLayoutState) => {
      setStateRaw((prev) => {
        const next = updater(prev)
        if (statesEqual(prev, next)) return next
        // Push previous state to history
        historyRef.current = [...historyRef.current, prev].slice(-MAX_HISTORY)
        // Clear redo future on new mutation
        futureRef.current = []
        return next
      })
    },
    []
  )

  /** setState that does NOT push to history (for selection-only changes) */
  const setStateNoHistory = useCallback(
    (updater: (prev: DrawerLayoutState) => DrawerLayoutState) => {
      setStateRaw(updater)
    },
    []
  )

  const undo = useCallback(() => {
    setStateRaw((prev) => {
      if (historyRef.current.length === 0) return prev
      const history = [...historyRef.current]
      const previous = history.pop()!
      historyRef.current = history
      futureRef.current = [...futureRef.current, prev]
      return { ...previous, selectedCellId: prev.selectedCellId }
    })
  }, [])

  const redo = useCallback(() => {
    setStateRaw((prev) => {
      if (futureRef.current.length === 0) return prev
      const future = [...futureRef.current]
      const next = future.pop()!
      futureRef.current = future
      historyRef.current = [...historyRef.current, prev]
      return { ...next, selectedCellId: prev.selectedCellId }
    })
  }, [])

  // ─── Keyboard shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      }
      // Also support Ctrl+Y for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))

  const setDrawerSize = useCallback((widthMm: number, depthMm: number) => {
    setState((prev) => {
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
  }, [setState])

  const setGridUnits = useCallback((gridX: number, gridY: number) => {
    setState((prev) => {
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
  }, [setState])

  const setHeightUnits = useCallback((h: number) => {
    setState((prev) => ({
      ...prev,
      heightUnits: clamp(h, LIMITS.HEIGHT_MIN, LIMITS.HEIGHT_MAX),
    }))
  }, [setState])

  const setBorderRadius = useCallback((r: number) => {
    setState((prev) => ({
      ...prev,
      borderRadius: clamp(r, LIMITS.BORDER_RADIUS_MIN, LIMITS.BORDER_RADIUS_MAX),
    }))
  }, [setState])

  const setMagnetHoles = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, magnetHoles: enabled }))
  }, [setState])

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
  }, [setState])

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
    [setState]
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
    [setState]
  )

  const deleteCell = useCallback((cellId: string) => {
    setState((prev) => ({
      ...prev,
      cells: prev.cells.filter((c) => c.id !== cellId),
      selectedCellId: prev.selectedCellId === cellId ? null : prev.selectedCellId,
    }))
  }, [setState])

  const selectCell = useCallback((cellId: string | null) => {
    setStateNoHistory((prev) => ({ ...prev, selectedCellId: cellId }))
  }, [setStateNoHistory])

  const clearCells = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cells: [],
      selectedCellId: null,
    }))
  }, [setState])

  const setDivisions = useCallback((cellId: string, divisionsX: number, divisionsY: number) => {
    const dx = Math.max(1, Math.min(6, Math.round(divisionsX)))
    const dy = Math.max(1, Math.min(6, Math.round(divisionsY)))
    setState((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) =>
        cell.id === cellId ? { ...cell, divisionsX: dx, divisionsY: dy } : cell
      ),
    }))
  }, [setState])

  const selectedCell = useMemo(
    () => state.cells.find((c) => c.id === state.selectedCellId) ?? null,
    [state.cells, state.selectedCellId]
  )

  const cellSizeX = state.drawerWidthMm / state.gridUnitsX
  const cellSizeY = state.drawerDepthMm / state.gridUnitsY

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

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
      setDivisions,
      undo,
      redo,
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
      setDivisions,
      undo,
      redo,
    ]
  )

  const meta = useMemo<DrawerMeta>(
    () => ({
      isExporting,
      selectedCell,
      cellSizeX,
      cellSizeY,
      canUndo,
      canRedo,
    }),
    [isExporting, selectedCell, cellSizeX, cellSizeY, canUndo, canRedo]
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
