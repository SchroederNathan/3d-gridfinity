import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'
import type { GridfinityConfig } from './constants'

export function generateFilename(config: GridfinityConfig): string {
  return `gridfinity-${config.modelType}-${config.gridX}x${config.gridY}.stl`
}

export function generateSTLBlob(geometry: THREE.BufferGeometry): Blob {
  const mesh = new THREE.Mesh(geometry)
  const exporter = new STLExporter()
  const result = exporter.parse(mesh, { binary: true })

  if (result instanceof DataView) {
    const buffer = (result.buffer as ArrayBuffer).slice(result.byteOffset, result.byteOffset + result.byteLength)
    return new Blob([buffer], { type: 'application/octet-stream' })
  }
  return new Blob([result], { type: 'application/octet-stream' })
}

export function exportToSTL(geometry: THREE.BufferGeometry, config: GridfinityConfig): void {
  const blob = generateSTLBlob(geometry)
  const filename = generateFilename(config)

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

type LayoutCell = {
  id: string
  gridX: number
  gridY: number
  spanX: number
  spanY: number
}

export function generateDrawerBaseplateFilename(gridUnitsX: number, gridUnitsY: number): string {
  return `gridfinity-drawer-baseplate-${gridUnitsX}x${gridUnitsY}.stl`
}

export function generateDrawerBinFilename(cell: LayoutCell, index: number): string {
  return `gridfinity-bin-${cell.spanX}x${cell.spanY}-${index}.stl`
}

export function mergeGeometriesForExport(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null
  if (geometries.length === 1) return geometries[0]

  let totalVertices = 0
  let totalIndices = 0

  for (const geom of geometries) {
    const pos = geom.getAttribute('position')
    totalVertices += pos.count
    if (geom.index) {
      totalIndices += geom.index.count
    } else {
      totalIndices += pos.count
    }
  }

  const positions = new Float32Array(totalVertices * 3)
  const normals = new Float32Array(totalVertices * 3)
  const indices = new Uint32Array(totalIndices)

  let vertexOffset = 0
  let indexOffset = 0
  let vertexCount = 0

  for (const geom of geometries) {
    const pos = geom.getAttribute('position')
    const norm = geom.getAttribute('normal')

    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i)
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i)
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i)

      if (norm) {
        normals[(vertexOffset + i) * 3] = norm.getX(i)
        normals[(vertexOffset + i) * 3 + 1] = norm.getY(i)
        normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i)
      }
    }

    if (geom.index) {
      for (let i = 0; i < geom.index.count; i++) {
        indices[indexOffset + i] = geom.index.getX(i) + vertexCount
      }
      indexOffset += geom.index.count
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[indexOffset + i] = vertexCount + i
      }
      indexOffset += pos.count
    }

    vertexOffset += pos.count
    vertexCount += pos.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))

  return merged
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

