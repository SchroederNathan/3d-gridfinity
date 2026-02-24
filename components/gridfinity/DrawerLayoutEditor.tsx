'use client'

import { useCallback, useState, useMemo, type ReactElement } from 'react'
import { useDrawer } from './DrawerContext'
import { canResize } from '@/lib/gridfinity/layout'

const CELL_RENDER_SIZE = 52
const GAP = 3

type ResizeHandle = 'e' | 's' | 'se' | null

export function DrawerLayoutEditor() {
  const { state, actions } = useDrawer()
  const [resizing, setResizing] = useState<{
    cellId: string
    handle: ResizeHandle
    startSpanX: number
    startSpanY: number
    startMouseX: number
    startMouseY: number
  } | null>(null)

  const svgWidth = state.gridUnitsX * (CELL_RENDER_SIZE + GAP) + GAP
  const svgHeight = state.gridUnitsY * (CELL_RENDER_SIZE + GAP) + GAP

  const handleCellClick = useCallback(
    (cellId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      actions.selectCell(cellId)
    },
    [actions]
  )

  const handleBackgroundClick = useCallback(() => {
    actions.selectCell(null)
  }, [actions])

  const handleResizeStart = useCallback(
    (
      cellId: string,
      handle: ResizeHandle,
      spanX: number,
      spanY: number,
      e: React.MouseEvent
    ) => {
      e.stopPropagation()
      e.preventDefault()
      setResizing({
        cellId,
        handle,
        startSpanX: spanX,
        startSpanY: spanY,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
      })
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizing) return

      const dx = e.clientX - resizing.startMouseX
      const dy = e.clientY - resizing.startMouseY

      const cellSize = CELL_RENDER_SIZE + GAP
      const deltaX = Math.round(dx / cellSize)
      const deltaY = Math.round(dy / cellSize)

      let newSpanX = resizing.startSpanX
      let newSpanY = resizing.startSpanY

      if (resizing.handle === 'e' || resizing.handle === 'se') {
        newSpanX = Math.max(1, resizing.startSpanX + deltaX)
      }
      if (resizing.handle === 's' || resizing.handle === 'se') {
        newSpanY = Math.max(1, resizing.startSpanY + deltaY)
      }

      if (
        newSpanX !== resizing.startSpanX ||
        newSpanY !== resizing.startSpanY
      ) {
        if (
          canResize(
            state.cells,
            resizing.cellId,
            newSpanX,
            newSpanY,
            state.gridUnitsX,
            state.gridUnitsY
          )
        ) {
          actions.resizeCell(resizing.cellId, newSpanX, newSpanY)
          setResizing((prev) =>
            prev
              ? {
                  ...prev,
                  startSpanX: newSpanX,
                  startSpanY: newSpanY,
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                }
              : null
          )
        }
      }
    },
    [resizing, state.cells, state.gridUnitsX, state.gridUnitsY, actions]
  )

  const handleMouseUp = useCallback(() => {
    setResizing(null)
  }, [])

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = []
    for (let x = 0; x <= state.gridUnitsX; x++) {
      const xPos = GAP + x * (CELL_RENDER_SIZE + GAP) - GAP / 2
      lines.push(
        <line
          key={`v-${x}`}
          x1={xPos}
          y1={0}
          x2={xPos}
          y2={svgHeight}
          stroke="#3f3f46"
          strokeWidth={1}
        />
      )
    }
    for (let y = 0; y <= state.gridUnitsY; y++) {
      const yPos = GAP + y * (CELL_RENDER_SIZE + GAP) - GAP / 2
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={yPos}
          x2={svgWidth}
          y2={yPos}
          stroke="#3f3f46"
          strokeWidth={1}
        />
      )
    }
    return lines
  }, [state.gridUnitsX, state.gridUnitsY, svgWidth, svgHeight])

  if (state.gridUnitsX === 0 || state.gridUnitsY === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
        <p className="text-zinc-500 text-sm">
          Enter drawer dimensions to begin
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBackgroundClick}
      >
        <rect width={svgWidth} height={svgHeight} fill="#18181b" rx={8} />
        {gridLines}

        {state.cells.map((cell) => {
          const x = GAP + cell.gridX * (CELL_RENDER_SIZE + GAP)
          const y = GAP + cell.gridY * (CELL_RENDER_SIZE + GAP)
          const width = cell.spanX * (CELL_RENDER_SIZE + GAP) - GAP
          const height = cell.spanY * (CELL_RENDER_SIZE + GAP) - GAP
          const isSelected = cell.id === state.selectedCellId

          return (
            <g key={cell.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={isSelected ? '#059669' : '#10b981'}
                stroke={isSelected ? '#34d399' : '#059669'}
                strokeWidth={isSelected ? 2 : 1}
                rx={6}
                className="cursor-pointer"
                onClick={(e) => handleCellClick(cell.id, e)}
              />
              <text
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={13}
                fontWeight={600}
                className="pointer-events-none select-none"
              >
                {cell.spanX}x{cell.spanY}
              </text>

              {isSelected && (
                <>
                  <rect
                    x={x + width - 7}
                    y={y + height / 2 - 7}
                    width={14}
                    height={14}
                    fill="#18181b"
                    stroke="#34d399"
                    strokeWidth={2}
                    rx={3}
                    className="cursor-ew-resize"
                    onMouseDown={(e) =>
                      handleResizeStart(cell.id, 'e', cell.spanX, cell.spanY, e)
                    }
                  />
                  <rect
                    x={x + width / 2 - 7}
                    y={y + height - 7}
                    width={14}
                    height={14}
                    fill="#18181b"
                    stroke="#34d399"
                    strokeWidth={2}
                    rx={3}
                    className="cursor-ns-resize"
                    onMouseDown={(e) =>
                      handleResizeStart(cell.id, 's', cell.spanX, cell.spanY, e)
                    }
                  />
                  <rect
                    x={x + width - 7}
                    y={y + height - 7}
                    width={14}
                    height={14}
                    fill="#18181b"
                    stroke="#34d399"
                    strokeWidth={2}
                    rx={3}
                    className="cursor-nwse-resize"
                    onMouseDown={(e) =>
                      handleResizeStart(cell.id, 'se', cell.spanX, cell.spanY, e)
                    }
                  />
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
