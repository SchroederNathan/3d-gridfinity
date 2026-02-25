'use client'

import { useCallback } from 'react'
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
  cells: LayoutCell[]
  selectedCellId: string | null
}

type SetState = (updater: (prev: DrawerLayoutState) => DrawerLayoutState) => void
type SetStateNoHistory = (updater: (prev: DrawerLayoutState) => DrawerLayoutState) => void

let cellIdCounter = 0
function generateCellId(): string {
  return `cell-${++cellIdCounter}`
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export function useDrawerActions(setState: SetState, setStateNoHistory: SetStateNoHistory) {
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

  const setStackingLip = useCallback((cellId: string, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      cells: prev.cells.map((cell) =>
        cell.id === cellId ? { ...cell, stackingLip: enabled } : cell
      ),
    }))
  }, [setState])

  return {
    setDrawerSize,
    setGridUnits,
    setHeightUnits,
    setBorderRadius,
    addCell,
    resizeCell,
    moveCell,
    deleteCell,
    selectCell,
    clearCells,
    setDivisions,
    setStackingLip,
  }
}
