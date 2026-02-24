import { describe, it, expect } from 'vitest'
import {
  calculateDimensions,
  createBaseplateGeometry,
  createBinGeometry,
  createBaseplateForDrawer,
  createBinForCell,
} from './geometry'
import { GRIDFINITY, DEFAULT_CONFIG } from './constants'
import type { GridfinityConfig } from './constants'
import type { LayoutCell } from './layout'
import * as THREE from 'three'

describe('calculateDimensions', () => {
  it('calculates correct width and depth for 1x1 grid', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 1, gridY: 1 }
    const dims = calculateDimensions(config)

    expect(dims.width).toBe(GRIDFINITY.CELL_SIZE)
    expect(dims.depth).toBe(GRIDFINITY.CELL_SIZE)
  })

  it('calculates correct width and depth for 2x3 grid', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 2, gridY: 3 }
    const dims = calculateDimensions(config)

    expect(dims.width).toBe(GRIDFINITY.CELL_SIZE * 2)
    expect(dims.depth).toBe(GRIDFINITY.CELL_SIZE * 3)
  })

  it('calculates correct height based on height units', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, heightUnits: 5 }
    const dims = calculateDimensions(config)

    expect(dims.height).toBe(GRIDFINITY.HEIGHT_UNIT * 5)
  })
})

describe('createBaseplateGeometry', () => {
  it('returns a BufferGeometry', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, modelType: 'baseplate' }
    const geometry = createBaseplateGeometry(config)

    expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
  })

  it('creates geometry with position attribute', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, modelType: 'baseplate' }
    const geometry = createBaseplateGeometry(config)

    expect(geometry.getAttribute('position')).toBeDefined()
  })

  it('creates geometry that fits expected dimensions (with bevel tolerance)', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 2, gridY: 2, modelType: 'baseplate' }
    const geometry = createBaseplateGeometry(config)
    geometry.computeBoundingBox()

    const box = geometry.boundingBox!
    const baseWidth = GRIDFINITY.CELL_SIZE * 2
    const baseDepth = GRIDFINITY.CELL_SIZE * 2
    const bevelAllowance = GRIDFINITY.FILLET_BOTTOM * 2

    const actualWidth = box.max.x - box.min.x
    const actualDepth = box.max.z - box.min.z

    expect(actualWidth).toBeGreaterThanOrEqual(baseWidth)
    expect(actualWidth).toBeLessThanOrEqual(baseWidth + bevelAllowance)
    expect(actualDepth).toBeGreaterThanOrEqual(baseDepth)
    expect(actualDepth).toBeLessThanOrEqual(baseDepth + bevelAllowance)
  })
})

describe('createBinGeometry', () => {
  it('returns a BufferGeometry', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, modelType: 'bin' }
    const geometry = createBinGeometry(config)

    expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
  })

  it('creates geometry with position attribute', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, modelType: 'bin' }
    const geometry = createBinGeometry(config)

    expect(geometry.getAttribute('position')).toBeDefined()
  })

  it('creates geometry with correct height (with bevel tolerance)', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, heightUnits: 4, modelType: 'bin' }
    const geometry = createBinGeometry(config)
    geometry.computeBoundingBox()

    const box = geometry.boundingBox!
    const expectedHeight = GRIDFINITY.HEIGHT_UNIT * 4
    const bevelAllowance = GRIDFINITY.FILLET_BOTTOM * 2

    const actualHeight = box.max.y - box.min.y

    expect(actualHeight).toBeGreaterThanOrEqual(expectedHeight)
    expect(actualHeight).toBeLessThanOrEqual(expectedHeight + bevelAllowance)
  })

  it('creates hollow bin (interior cavity)', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 2, gridY: 2, heightUnits: 3, modelType: 'bin' }
    const geometry = createBinGeometry(config)

    const positionAttr = geometry.getAttribute('position')
    expect(positionAttr.count).toBeGreaterThan(24)
  })
})

describe('createBaseplateForDrawer', () => {
  it('returns a BufferGeometry for drawer baseplate', () => {
    const geometry = createBaseplateForDrawer(3, 2, { borderRadius: 0.8, magnetHoles: false })
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
  })

  it('creates geometry sized for full drawer grid', () => {
    const geometry = createBaseplateForDrawer(3, 2, { borderRadius: 0.8, magnetHoles: false })
    geometry.computeBoundingBox()

    const box = geometry.boundingBox!
    const expectedWidth = GRIDFINITY.CELL_SIZE * 3
    const expectedDepth = GRIDFINITY.CELL_SIZE * 2
    const bevelAllowance = GRIDFINITY.FILLET_BOTTOM * 2

    const actualWidth = box.max.x - box.min.x
    const actualDepth = box.max.z - box.min.z

    expect(actualWidth).toBeGreaterThanOrEqual(expectedWidth)
    expect(actualWidth).toBeLessThanOrEqual(expectedWidth + bevelAllowance)
    expect(actualDepth).toBeGreaterThanOrEqual(expectedDepth)
    expect(actualDepth).toBeLessThanOrEqual(expectedDepth + bevelAllowance)
  })

  it('uses provided border radius', () => {
    const geometry = createBaseplateForDrawer(2, 2, { borderRadius: 2.0, magnetHoles: false })
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
  })
})

describe('createBinForCell', () => {
  it('returns a BufferGeometry', () => {
    const cell = { id: 'a', gridX: 0, gridY: 0, spanX: 1, spanY: 1 }
    const geometry = createBinForCell(cell, { heightUnits: 3, borderRadius: 0.8 })
    expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
  })

  it('creates geometry sized for cell span', () => {
    const cell = { id: 'a', gridX: 0, gridY: 0, spanX: 2, spanY: 3 }
    const geometry = createBinForCell(cell, { heightUnits: 3, borderRadius: 0.8 })
    geometry.computeBoundingBox()

    const box = geometry.boundingBox!
    const expectedWidth = GRIDFINITY.CELL_SIZE * 2
    const expectedDepth = GRIDFINITY.CELL_SIZE * 3
    const bevelAllowance = GRIDFINITY.FILLET_BOTTOM * 2

    const actualWidth = box.max.x - box.min.x
    const actualDepth = box.max.z - box.min.z

    expect(actualWidth).toBeGreaterThanOrEqual(expectedWidth)
    expect(actualWidth).toBeLessThanOrEqual(expectedWidth + bevelAllowance)
    expect(actualDepth).toBeGreaterThanOrEqual(expectedDepth)
    expect(actualDepth).toBeLessThanOrEqual(expectedDepth + bevelAllowance)
  })

  it('positions bin according to cell grid position', () => {
    const cell = { id: 'a', gridX: 1, gridY: 2, spanX: 1, spanY: 1 }
    const geometry = createBinForCell(cell, { heightUnits: 3, borderRadius: 0.8 }, { gridUnitsX: 4, gridUnitsY: 4 })
    geometry.computeBoundingBox()

    const box = geometry.boundingBox!
    const cellSize = GRIDFINITY.CELL_SIZE

    // Center of 1x1 cell at position (1,2) in a 4x4 grid
    // Total grid: 4*42 = 168mm, centered at origin means range -84 to +84
    // Cell 1,2 center: -84 + 1*42 + 21 = -21mm for X
    const expectedCenterX = -((4 * cellSize) / 2) + (1 * cellSize) + (cellSize / 2)
    const actualCenterX = (box.min.x + box.max.x) / 2

    expect(actualCenterX).toBeCloseTo(expectedCenterX, 0)
  })
})
