'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useDrawerHistory } from './useDrawerHistory'
import { useDrawerActions } from './useDrawerActions'
import type { LayoutCell } from '@/lib/gridfinity/layout'

type DrawerLayoutState = {
  drawerWidthMm: number
  drawerDepthMm: number
  gridUnitsX: number
  gridUnitsY: number
  heightUnits: number
  borderRadius: number
  cells: LayoutCell[]
  selectedCellId: string | null
}

type DrawerActions = {
  setDrawerSize: (widthMm: number, depthMm: number) => void
  setGridUnits: (gridX: number, gridY: number) => void
  setHeightUnits: (h: number) => void
  setBorderRadius: (r: number) => void
  addCell: () => LayoutCell | null
  resizeCell: (cellId: string, spanX: number, spanY: number) => boolean
  moveCell: (cellId: string, gridX: number, gridY: number) => boolean
  deleteCell: (cellId: string) => void
  selectCell: (cellId: string | null) => void
  clearCells: () => void
  setDivisions: (cellId: string, divisionsX: number, divisionsY: number) => void
  setStackingLip: (cellId: string, enabled: boolean) => void
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
  cells: [],
  selectedCellId: null,
}

type DrawerProviderProps = {
  children: ReactNode
  initialState?: Partial<DrawerLayoutState>
}

export function DrawerProvider({ children, initialState }: DrawerProviderProps) {
  const {
    state, setState, setStateNoHistory,
    undo, redo, canUndo, canRedo,
  } = useDrawerHistory({ ...DEFAULT_DRAWER_STATE, ...initialState })

  const cellActions = useDrawerActions(setState, setStateNoHistory)

  const selectedCell = useMemo(
    () => state.cells.find((c) => c.id === state.selectedCellId) ?? null,
    [state.cells, state.selectedCellId]
  )

  const cellSizeX = state.drawerWidthMm / state.gridUnitsX
  const cellSizeY = state.drawerDepthMm / state.gridUnitsY

  const actions = useMemo<DrawerActions>(
    () => ({ ...cellActions, undo, redo }),
    [cellActions, undo, redo]
  )

  const meta = useMemo<DrawerMeta>(
    () => ({
      isExporting: false,
      selectedCell,
      cellSizeX,
      cellSizeY,
      canUndo,
      canRedo,
    }),
    [selectedCell, cellSizeX, cellSizeY, canUndo, canRedo]
  )

  const value = useMemo<DrawerContextValue>(
    () => ({ state, actions, meta }),
    [state, actions, meta]
  )

  return (
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  )
}
