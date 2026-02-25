export type LayoutCell = {
  id: string
  gridX: number
  gridY: number
  spanX: number
  spanY: number
  divisionsX?: number
  divisionsY?: number
  stackingLip?: boolean
}

type EmptyRect = {
  x: number
  y: number
  spanX: number
  spanY: number
}

export function getOccupiedPositions(cells: LayoutCell[]): Set<string> {
  const occupied = new Set<string>()
  for (const cell of cells) {
    for (let x = cell.gridX; x < cell.gridX + cell.spanX; x++) {
      for (let y = cell.gridY; y < cell.gridY + cell.spanY; y++) {
        occupied.add(`${x},${y}`)
      }
    }
  }
  return occupied
}

export function canPlaceCell(
  existingCells: LayoutCell[],
  newCell: LayoutCell,
  gridX: number,
  gridY: number
): boolean {
  // Validate spans
  if (newCell.spanX <= 0 || newCell.spanY <= 0) {
    return false
  }

  // Validate coordinates
  if (newCell.gridX < 0 || newCell.gridY < 0) {
    return false
  }

  // Check bounds
  if (newCell.gridX + newCell.spanX > gridX) {
    return false
  }
  if (newCell.gridY + newCell.spanY > gridY) {
    return false
  }

  // Check overlaps
  const occupied = getOccupiedPositions(existingCells)
  for (let x = newCell.gridX; x < newCell.gridX + newCell.spanX; x++) {
    for (let y = newCell.gridY; y < newCell.gridY + newCell.spanY; y++) {
      if (occupied.has(`${x},${y}`)) {
        return false
      }
    }
  }

  return true
}

export function canResize(
  cells: LayoutCell[],
  cellId: string,
  newSpanX: number,
  newSpanY: number,
  gridX: number,
  gridY: number
): boolean {
  const cellIndex = cells.findIndex((c) => c.id === cellId)
  if (cellIndex === -1) {
    return false
  }

  const cell = cells[cellIndex]
  const resizedCell: LayoutCell = {
    ...cell,
    spanX: newSpanX,
    spanY: newSpanY,
  }

  // Check placement excluding the current cell
  const otherCells = cells.filter((c) => c.id !== cellId)
  return canPlaceCell(otherCells, resizedCell, gridX, gridY)
}

export function findLargestEmpty(
  cells: LayoutCell[],
  gridX: number,
  gridY: number
): EmptyRect | null {
  if (gridX <= 0 || gridY <= 0) {
    return null
  }

  const occupied = getOccupiedPositions(cells)

  // If grid is empty, return full grid
  if (occupied.size === 0) {
    return { x: 0, y: 0, spanX: gridX, spanY: gridY }
  }

  let best: EmptyRect | null = null
  let bestArea = 0

  // Try all possible rectangles
  for (let startX = 0; startX < gridX; startX++) {
    for (let startY = 0; startY < gridY; startY++) {
      // Skip if starting position is occupied
      if (occupied.has(`${startX},${startY}`)) {
        continue
      }

      // Try all possible sizes from this position
      for (let spanX = 1; startX + spanX <= gridX; spanX++) {
        for (let spanY = 1; startY + spanY <= gridY; spanY++) {
          // Check if this rectangle is entirely unoccupied
          let valid = true
          outer: for (let x = startX; x < startX + spanX; x++) {
            for (let y = startY; y < startY + spanY; y++) {
              if (occupied.has(`${x},${y}`)) {
                valid = false
                break outer
              }
            }
          }

          if (valid) {
            const area = spanX * spanY
            if (area > bestArea) {
              bestArea = area
              best = { x: startX, y: startY, spanX, spanY }
            }
          }
        }
      }
    }
  }

  return best
}
