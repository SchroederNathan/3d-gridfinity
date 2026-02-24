import { describe, it, expect, vi } from 'vitest'
import {
  exportToSTL,
  generateSTLBlob,
  generateFilename,
  generateDrawerBaseplateFilename,
  generateDrawerBinFilename,
  mergeGeometriesForExport,
} from './export-stl'
import { DEFAULT_CONFIG } from './constants'
import type { GridfinityConfig } from './constants'
import type { LayoutCell } from './layout'
import * as THREE from 'three'

describe('generateFilename', () => {
  it('generates filename with grid dimensions and type', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 2, gridY: 3, modelType: 'bin' }
    const filename = generateFilename(config)

    expect(filename).toBe('gridfinity-bin-2x3.stl')
  })

  it('generates filename for baseplate', () => {
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 4, gridY: 4, modelType: 'baseplate' }
    const filename = generateFilename(config)

    expect(filename).toBe('gridfinity-baseplate-4x4.stl')
  })
})

describe('generateSTLBlob', () => {
  it('returns a Blob', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const blob = generateSTLBlob(geometry)

    expect(blob).toBeInstanceOf(Blob)
  })

  it('returns binary STL format (application/octet-stream)', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const blob = generateSTLBlob(geometry)

    expect(blob.type).toBe('application/octet-stream')
  })

  it('generates non-empty blob for valid geometry', () => {
    const geometry = new THREE.BoxGeometry(10, 10, 10)
    const blob = generateSTLBlob(geometry)

    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('exportToSTL', () => {
  it('triggers download with correct filename', () => {
    const mockCreateElement = vi.spyOn(document, 'createElement')
    const mockClick = vi.fn()
    const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node)
    const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node)

    mockCreateElement.mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      style: {},
    } as unknown as HTMLAnchorElement)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const config: GridfinityConfig = { ...DEFAULT_CONFIG, gridX: 2, gridY: 2, modelType: 'bin' }

    exportToSTL(geometry, config)

    expect(mockClick).toHaveBeenCalled()

    mockCreateElement.mockRestore()
    mockAppendChild.mockRestore()
    mockRemoveChild.mockRestore()
  })
})

describe('generateDrawerBaseplateFilename', () => {
  it('generates filename with grid dimensions', () => {
    const filename = generateDrawerBaseplateFilename(5, 4)
    expect(filename).toBe('gridfinity-drawer-baseplate-5x4.stl')
  })
})

describe('generateDrawerBinFilename', () => {
  it('generates filename with cell span and index', () => {
    const cell = { id: 'cell-1', gridX: 0, gridY: 0, spanX: 2, spanY: 1 }
    const filename = generateDrawerBinFilename(cell, 0)
    expect(filename).toBe('gridfinity-bin-2x1-0.stl')
  })

  it('includes index for multiple bins of same size', () => {
    const cell = { id: 'cell-5', gridX: 3, gridY: 2, spanX: 1, spanY: 1 }
    const filename = generateDrawerBinFilename(cell, 4)
    expect(filename).toBe('gridfinity-bin-1x1-4.stl')
  })
})

describe('mergeGeometriesForExport', () => {
  it('merges multiple geometries into one', () => {
    const geom1 = new THREE.BoxGeometry(1, 1, 1)
    const geom2 = new THREE.BoxGeometry(1, 1, 1)
    geom2.translate(2, 0, 0)

    const merged = mergeGeometriesForExport([geom1, geom2])
    expect(merged).toBeInstanceOf(THREE.BufferGeometry)
    expect(merged!.getAttribute('position').count).toBeGreaterThan(geom1.getAttribute('position').count)
  })

  it('returns single geometry unchanged', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1)
    const merged = mergeGeometriesForExport([geom])
    expect(merged!.getAttribute('position').count).toBe(geom.getAttribute('position').count)
  })

  it('returns null for empty array', () => {
    const merged = mergeGeometriesForExport([])
    expect(merged).toBeNull()
  })
})
