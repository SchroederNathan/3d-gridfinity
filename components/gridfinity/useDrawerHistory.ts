'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

type DrawerLayoutState = {
  drawerWidthMm: number
  drawerDepthMm: number
  gridUnitsX: number
  gridUnitsY: number
  heightUnits: number
  borderRadius: number
  cells: import('@/lib/gridfinity/layout').LayoutCell[]
  selectedCellId: string | null
}

const MAX_HISTORY = 50

/** Compare states ignoring selectedCellId (selection isn't an undoable mutation) */
function statesEqual(a: DrawerLayoutState, b: DrawerLayoutState): boolean {
  return (
    a.drawerWidthMm === b.drawerWidthMm &&
    a.drawerDepthMm === b.drawerDepthMm &&
    a.gridUnitsX === b.gridUnitsX &&
    a.gridUnitsY === b.gridUnitsY &&
    a.heightUnits === b.heightUnits &&
    a.borderRadius === b.borderRadius &&
    a.cells === b.cells
  )
}

export function useDrawerHistory(initialState: DrawerLayoutState) {
  const [state, setStateRaw] = useState<DrawerLayoutState>(initialState)

  const historyRef = useRef<DrawerLayoutState[]>([])
  const futureRef = useRef<DrawerLayoutState[]>([])

  /** setState wrapper that pushes to history for undoable mutations */
  const setState = useCallback(
    (updater: (prev: DrawerLayoutState) => DrawerLayoutState) => {
      setStateRaw((prev) => {
        const next = updater(prev)
        if (statesEqual(prev, next)) return next
        historyRef.current = [...historyRef.current, prev].slice(-MAX_HISTORY)
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

  // Keyboard shortcuts
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return { state, setState, setStateNoHistory, undo, redo, canUndo, canRedo }
}
