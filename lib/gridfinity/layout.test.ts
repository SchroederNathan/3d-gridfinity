import { describe, it, expect } from 'vitest'
import {
  calculateGrid,
  canPlaceCell,
  findLargestEmpty,
  canResize,
  getOccupiedPositions,
  type LayoutCell,
} from './layout'
import { GRIDFINITY } from './constants'

describe('calculateGrid', () => {
  it('calculates grid units from drawer dimensions', () => {
    const result = calculateGrid(210, 168)
    expect(result).toEqual({ gridX: 5, gridY: 4 })
  })

  it('floors partial units', () => {
    const result = calculateGrid(100, 100)
    // 100 / 42 = 2.38 → floors to 2
    expect(result).toEqual({ gridX: 2, gridY: 2 })
  })

  it('handles exact multiples', () => {
    const result = calculateGrid(84, 126)
    // 84 / 42 = 2, 126 / 42 = 3
    expect(result).toEqual({ gridX: 2, gridY: 3 })
  })

  it('returns zero for dimensions smaller than one cell', () => {
    const result = calculateGrid(30, 41)
    expect(result).toEqual({ gridX: 0, gridY: 0 })
  })

  it('uses GRIDFINITY.CELL_SIZE constant', () => {
    const result = calculateGrid(GRIDFINITY.CELL_SIZE * 3, GRIDFINITY.CELL_SIZE * 2)
    expect(result).toEqual({ gridX: 3, gridY: 2 })
  })
})

describe('getOccupiedPositions', () => {
  it('returns empty set for no cells', () => {
    const result = getOccupiedPositions([])
    expect(result.size).toBe(0)
  })

  it('returns positions for single 1x1 cell', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
    ]
    const result = getOccupiedPositions(cells)
    expect(result).toEqual(new Set(['0,0']))
  })

  it('returns all positions for multi-span cell', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 1, gridY: 2, spanX: 2, spanY: 3 },
    ]
    const result = getOccupiedPositions(cells)
    expect(result).toEqual(
      new Set(['1,2', '2,2', '1,3', '2,3', '1,4', '2,4'])
    )
  })

  it('combines positions from multiple cells', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
      { id: 'b', gridX: 2, gridY: 1, spanX: 1, spanY: 1 },
    ]
    const result = getOccupiedPositions(cells)
    expect(result).toEqual(new Set(['0,0', '2,1']))
  })
})

describe('canPlaceCell', () => {
  it('allows placement in empty grid', () => {
    const newCell: LayoutCell = { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(true)
  })

  it('rejects placement outside grid bounds (X)', () => {
    const newCell: LayoutCell = { id: 'a', gridX: 5, gridY: 0, spanX: 1, spanY: 1 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(false)
  })

  it('rejects placement outside grid bounds (Y)', () => {
    const newCell: LayoutCell = { id: 'a', gridX: 0, gridY: 4, spanX: 1, spanY: 1 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(false)
  })

  it('rejects placement that extends beyond grid bounds', () => {
    const newCell: LayoutCell = { id: 'a', gridX: 4, gridY: 3, spanX: 2, spanY: 2 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(false)
  })

  it('rejects overlapping cells', () => {
    const existing: LayoutCell[] = [
      { id: 'a', gridX: 1, gridY: 1, spanX: 2, spanY: 2 },
    ]
    const newCell: LayoutCell = { id: 'b', gridX: 2, gridY: 2, spanX: 1, spanY: 1 }
    expect(canPlaceCell(existing, newCell, 5, 4)).toBe(false)
  })

  it('allows adjacent non-overlapping cells', () => {
    const existing: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 2 },
    ]
    const newCell: LayoutCell = { id: 'b', gridX: 2, gridY: 0, spanX: 1, spanY: 1 }
    expect(canPlaceCell(existing, newCell, 5, 4)).toBe(true)
  })

  it('rejects negative coordinates', () => {
    const newCell: LayoutCell = { id: 'a', gridX: -1, gridY: 0, spanX: 1, spanY: 1 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(false)
  })

  it('rejects zero or negative spans', () => {
    const newCell: LayoutCell = { id: 'a', gridX: 0, gridY: 0, spanX: 0, spanY: 1 }
    expect(canPlaceCell([], newCell, 5, 4)).toBe(false)
  })
})

describe('canResize', () => {
  it('allows resize in empty space', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
    ]
    expect(canResize(cells, 'a', 2, 2, 5, 4)).toBe(true)
  })

  it('blocks resize that would overlap another cell', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
      { id: 'b', gridX: 1, gridY: 0, spanX: 1, spanY: 1 },
    ]
    expect(canResize(cells, 'a', 2, 1, 5, 4)).toBe(false)
  })

  it('blocks resize that would exceed grid bounds', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 4, gridY: 3, spanX: 1, spanY: 1 },
    ]
    expect(canResize(cells, 'a', 2, 2, 5, 4)).toBe(false)
  })

  it('returns false for non-existent cell', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
    ]
    expect(canResize(cells, 'nonexistent', 2, 2, 5, 4)).toBe(false)
  })

  it('allows same-size resize', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 2 },
    ]
    expect(canResize(cells, 'a', 2, 2, 5, 4)).toBe(true)
  })

  it('allows shrinking even when adjacent cells exist', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 2 },
      { id: 'b', gridX: 2, gridY: 0, spanX: 1, spanY: 1 },
    ]
    expect(canResize(cells, 'a', 1, 1, 5, 4)).toBe(true)
  })
})

describe('findLargestEmpty', () => {
  it('returns full grid when empty', () => {
    const result = findLargestEmpty([], 3, 3)
    expect(result).toEqual({ x: 0, y: 0, spanX: 3, spanY: 3 })
  })

  it('returns null when grid is full', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 2 },
    ]
    const result = findLargestEmpty(cells, 2, 2)
    expect(result).toBeNull()
  })

  it('finds empty space in partially filled grid', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
    ]
    const result = findLargestEmpty(cells, 2, 2)
    // Should find some empty space
    expect(result).not.toBeNull()
    expect(result!.spanX).toBeGreaterThan(0)
    expect(result!.spanY).toBeGreaterThan(0)
  })

  it('finds largest contiguous empty rectangle', () => {
    // Grid layout:
    // [X][ ][ ]
    // [ ][ ][ ]
    // [ ][ ][ ]
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 },
    ]
    const result = findLargestEmpty(cells, 3, 3)
    // Largest empty area: 3x2 at (0,1) or 2x3 at (1,0) - both have area 6
    expect(result).not.toBeNull()
    expect(result!.spanX * result!.spanY).toBeGreaterThanOrEqual(6)
  })

  it('returns valid placement within grid bounds', () => {
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 1 },
    ]
    const result = findLargestEmpty(cells, 3, 2)
    expect(result).not.toBeNull()
    expect(result!.x + result!.spanX).toBeLessThanOrEqual(3)
    expect(result!.y + result!.spanY).toBeLessThanOrEqual(2)
  })

  it('returns 1x1 when only single cells available', () => {
    // Grid layout:
    // [X][X]
    // [X][ ]
    const cells: LayoutCell[] = [
      { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 1 },
      { id: 'b', gridX: 0, gridY: 1, spanX: 1, spanY: 1 },
    ]
    const result = findLargestEmpty(cells, 2, 2)
    expect(result).toEqual({ x: 1, y: 1, spanX: 1, spanY: 1 })
  })
})
