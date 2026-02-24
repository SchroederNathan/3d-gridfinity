import * as THREE from 'three'
import { GRIDFINITY } from './constants'
import type { GridfinityConfig } from './constants'

export type Dimensions = {
  width: number
  depth: number
  height: number
}

export function calculateDimensions(config: GridfinityConfig): Dimensions {
  return {
    width: config.gridX * GRIDFINITY.CELL_SIZE,
    depth: config.gridY * GRIDFINITY.CELL_SIZE,
    height: config.heightUnits * GRIDFINITY.HEIGHT_UNIT,
  }
}

function createRoundedRectShape(
  width: number,
  depth: number,
  radius: number
): THREE.Shape {
  const shape = new THREE.Shape()
  const hw = width / 2
  const hd = depth / 2
  const r = Math.min(radius, Math.min(hw, hd))

  shape.moveTo(-hw + r, -hd)
  shape.lineTo(hw - r, -hd)
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r)
  shape.lineTo(hw, hd - r)
  shape.quadraticCurveTo(hw, hd, hw - r, hd)
  shape.lineTo(-hw + r, hd)
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r)
  shape.lineTo(-hw, -hd + r)
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd)

  return shape
}

function addMagnetHoles(
  geometry: THREE.BufferGeometry,
  config: GridfinityConfig
): THREE.BufferGeometry {
  if (!config.magnetHoles) return geometry

  const dims = calculateDimensions(config)
  const holeRadius = GRIDFINITY.MAGNET_HOLE_DIAMETER / 2
  const holeDepth = GRIDFINITY.MAGNET_HOLE_DEPTH
  const inset = GRIDFINITY.CELL_SIZE / 2 - 4

  const holes: THREE.BufferGeometry[] = []
  const cylinderGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeDepth, 16)
  cylinderGeom.rotateX(Math.PI / 2)
  cylinderGeom.translate(0, 0, -holeDepth / 2)

  for (let x = 0; x < config.gridX; x++) {
    for (let y = 0; y < config.gridY; y++) {
      const cellCenterX = -dims.width / 2 + GRIDFINITY.CELL_SIZE / 2 + x * GRIDFINITY.CELL_SIZE
      const cellCenterZ = -dims.depth / 2 + GRIDFINITY.CELL_SIZE / 2 + y * GRIDFINITY.CELL_SIZE

      const corners = [
        [cellCenterX - inset, cellCenterZ - inset],
        [cellCenterX + inset, cellCenterZ - inset],
        [cellCenterX - inset, cellCenterZ + inset],
        [cellCenterX + inset, cellCenterZ + inset],
      ]

      for (const [cx, cz] of corners) {
        const hole = cylinderGeom.clone()
        hole.translate(cx, 0, cz)
        holes.push(hole)
      }
    }
  }

  return geometry
}

export function createBaseplateGeometry(config: GridfinityConfig): THREE.BufferGeometry {
  const dims = calculateDimensions(config)
  const height = GRIDFINITY.BASE_HEIGHT

  const outerShape = createRoundedRectShape(dims.width, dims.depth, config.borderRadius)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: height,
    bevelEnabled: true,
    bevelSize: GRIDFINITY.FILLET_BOTTOM,
    bevelThickness: GRIDFINITY.FILLET_BOTTOM,
    bevelSegments: 3,
  }

  const geometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings)
  geometry.rotateX(-Math.PI / 2)

  return addMagnetHoles(geometry, config)
}

export function createBinGeometry(config: GridfinityConfig): THREE.BufferGeometry {
  const dims = calculateDimensions(config)
  const wallThickness = GRIDFINITY.WALL_THICKNESS
  const baseHeight = GRIDFINITY.BASE_HEIGHT
  const totalHeight = dims.height

  const outerShape = createRoundedRectShape(dims.width, dims.depth, config.borderRadius)

  const innerWidth = dims.width - wallThickness * 2
  const innerDepth = dims.depth - wallThickness * 2
  const innerRadius = Math.max(0, config.borderRadius - wallThickness)
  const innerShape = createRoundedRectShape(innerWidth, innerDepth, innerRadius)

  const baseExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: baseHeight,
    bevelEnabled: true,
    bevelSize: GRIDFINITY.FILLET_BOTTOM,
    bevelThickness: GRIDFINITY.FILLET_BOTTOM,
    bevelSegments: 3,
  }

  const baseGeometry = new THREE.ExtrudeGeometry(outerShape, baseExtrudeSettings)
  baseGeometry.rotateX(-Math.PI / 2)

  const wallHeight = totalHeight - baseHeight
  if (wallHeight <= 0) {
    return baseGeometry
  }

  outerShape.holes.push(innerShape)

  const wallExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: wallHeight,
    bevelEnabled: false,
  }

  const wallGeometry = new THREE.ExtrudeGeometry(outerShape, wallExtrudeSettings)
  wallGeometry.rotateX(-Math.PI / 2)
  // Offset walls slightly above the base to prevent Z-fighting on the floor
  wallGeometry.translate(0, baseHeight + 0.01, 0)

  const mergedGeometry = mergeGeometries([baseGeometry, wallGeometry])
  return mergedGeometry ?? baseGeometry
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
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

export function createGridfinityGeometry(config: GridfinityConfig): THREE.BufferGeometry {
  return config.modelType === 'baseplate'
    ? createBaseplateGeometry(config)
    : createBinGeometry(config)
}

export type DrawerBaseplateConfig = {
  borderRadius: number
  magnetHoles: boolean
}

export function createBaseplateForDrawer(
  gridUnitsX: number,
  gridUnitsY: number,
  config: DrawerBaseplateConfig
): THREE.BufferGeometry {
  const internalConfig: GridfinityConfig = {
    gridX: gridUnitsX,
    gridY: gridUnitsY,
    heightUnits: 1,
    borderRadius: config.borderRadius,
    modelType: 'baseplate',
    magnetHoles: config.magnetHoles,
  }
  return createBaseplateGeometry(internalConfig)
}

type LayoutCell = {
  id: string
  gridX: number
  gridY: number
  spanX: number
  spanY: number
}

export type BinCellConfig = {
  heightUnits: number
  borderRadius: number
}

export type GridContext = {
  gridUnitsX: number
  gridUnitsY: number
}

export function createBinForCell(
  cell: LayoutCell,
  config: BinCellConfig,
  gridContext?: GridContext
): THREE.BufferGeometry {
  const binConfig: GridfinityConfig = {
    gridX: cell.spanX,
    gridY: cell.spanY,
    heightUnits: config.heightUnits,
    borderRadius: config.borderRadius,
    modelType: 'bin',
    magnetHoles: false,
  }

  const geometry = createBinGeometry(binConfig)

  if (gridContext) {
    const totalWidth = gridContext.gridUnitsX * GRIDFINITY.CELL_SIZE
    const totalDepth = gridContext.gridUnitsY * GRIDFINITY.CELL_SIZE

    const cellCenterX =
      -(totalWidth / 2) +
      cell.gridX * GRIDFINITY.CELL_SIZE +
      (cell.spanX * GRIDFINITY.CELL_SIZE) / 2
    const cellCenterZ =
      -(totalDepth / 2) +
      cell.gridY * GRIDFINITY.CELL_SIZE +
      (cell.spanY * GRIDFINITY.CELL_SIZE) / 2

    geometry.translate(cellCenterX, 0, cellCenterZ)
  }

  return geometry
}
