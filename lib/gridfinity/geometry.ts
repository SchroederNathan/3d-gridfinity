import * as THREE from 'three'
import { GRIDFINITY } from './constants'
import type { GridfinityConfig } from './constants'

export type Dimensions = {
  width: number
  depth: number
  height: number
}

export type CellSizes = {
  cellSizeX: number
  cellSizeY: number
}

export function calculateDimensions(config: GridfinityConfig, cellSizes?: CellSizes): Dimensions {
  const csX = cellSizes?.cellSizeX ?? GRIDFINITY.CELL_SIZE
  const csY = cellSizes?.cellSizeY ?? GRIDFINITY.CELL_SIZE
  return {
    width: config.gridX * csX,
    depth: config.gridY * csY,
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

export function createBaseplateGeometry(config: GridfinityConfig, cellSizes?: CellSizes): THREE.BufferGeometry {
  const dims = calculateDimensions(config, cellSizes)
  const csX = cellSizes?.cellSizeX ?? GRIDFINITY.CELL_SIZE
  const csY = cellSizes?.cellSizeY ?? GRIDFINITY.CELL_SIZE

  const slabHeight = 2.15          // bottom solid slab
  const wallHeight = GRIDFINITY.BASE_HEIGHT - slabHeight  // = ~2.85mm raised grid walls
  const wallThickness = 0.8        // thin wall between cells
  const chamfer = 0.4              // top-edge chamfer on each cell pocket

  const geometries: THREE.BufferGeometry[] = []

  // ── 1. Bottom slab with rounded outer corners ──────────────
  const slabShape = createRoundedRectShape(dims.width, dims.depth, config.borderRadius)
  const slabGeom = new THREE.ExtrudeGeometry(slabShape, {
    depth: slabHeight,
    bevelEnabled: true,
    bevelSize: GRIDFINITY.FILLET_BOTTOM,
    bevelThickness: GRIDFINITY.FILLET_BOTTOM,
    bevelSegments: 3,
  })
  slabGeom.rotateX(-Math.PI / 2)
  geometries.push(slabGeom)

  const hw = dims.width / 2
  const hd = dims.depth / 2

  // ── 2. X-direction walls (run full depth, one per column boundary) ──
  for (let x = 0; x <= config.gridX; x++) {
    const xPos = -hw + x * csX
    // Clamp to outer boundary so edge walls align with rounded base
    const wallGeom = new THREE.BoxGeometry(wallThickness, wallHeight, dims.depth)
    wallGeom.translate(xPos, slabHeight + wallHeight / 2, 0)
    geometries.push(wallGeom)
  }

  // ── 3. Y-direction walls (run full width, one per row boundary) ──
  for (let y = 0; y <= config.gridY; y++) {
    const zPos = -hd + y * csY
    const wallGeom = new THREE.BoxGeometry(dims.width, wallHeight, wallThickness)
    wallGeom.translate(0, slabHeight + wallHeight / 2, zPos)
    geometries.push(wallGeom)
  }

  // ── 4. Chamfered top rim per cell pocket ──────────────────────
  // A small inward-bevelled cap on each cell to guide the bin base
  for (let x = 0; x < config.gridX; x++) {
    for (let y = 0; y < config.gridY; y++) {
      const cellCX = -hw + csX * x + csX / 2
      const cellCZ = -hd + csY * y + csY / 2
      const innerW = csX - wallThickness
      const innerD = csY - wallThickness

      // Outer lip shape (cell boundary minus wall)
      const rimShape = createRoundedRectShape(innerW, innerD, Math.max(0, config.borderRadius - wallThickness * 2))
      const rimHole  = createRoundedRectShape(innerW - chamfer * 2, innerD - chamfer * 2, Math.max(0, config.borderRadius - wallThickness * 2 - chamfer))
      rimShape.holes.push(rimHole)

      const rimGeom = new THREE.ExtrudeGeometry(rimShape, { depth: chamfer, bevelEnabled: false })
      rimGeom.rotateX(-Math.PI / 2)
      rimGeom.translate(cellCX, GRIDFINITY.BASE_HEIGHT, cellCZ)
      geometries.push(rimGeom)
    }
  }

  const merged = mergeGeometries(geometries)
  return merged ?? geometries[0]
}

export function createBinGeometry(config: GridfinityConfig, cellSizes?: CellSizes): THREE.BufferGeometry {
  const dims = calculateDimensions(config, cellSizes)
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
}

export function createBaseplateForDrawer(
  gridUnitsX: number,
  gridUnitsY: number,
  config: DrawerBaseplateConfig,
  cellSizes?: CellSizes
): THREE.BufferGeometry {
  const internalConfig: GridfinityConfig = {
    gridX: gridUnitsX,
    gridY: gridUnitsY,
    heightUnits: 1,
    borderRadius: config.borderRadius,
    modelType: 'baseplate',
  }
  return createBaseplateGeometry(internalConfig, cellSizes)
}

type LayoutCell = {
  id: string
  gridX: number
  gridY: number
  spanX: number
  spanY: number
  divisionsX?: number
  divisionsY?: number
  stackingLip?: boolean
}

export type BinCellConfig = {
  heightUnits: number
  borderRadius: number
}

export type GridContext = {
  gridUnitsX: number
  gridUnitsY: number
  cellSizeX?: number
  cellSizeY?: number
}

/** Create internal divider wall geometries for a bin with compartments */
function createDividerGeometries(
  binWidth: number,
  binDepth: number,
  wallHeight: number,
  divisionsX: number,
  divisionsY: number
): THREE.BufferGeometry[] {
  const wallThickness = GRIDFINITY.WALL_THICKNESS
  const dividerGap = 1 // 1mm shorter than outer walls
  const dividerHeight = wallHeight - dividerGap
  if (dividerHeight <= 0) return []

  const innerWidth = binWidth - wallThickness * 2
  const innerDepth = binDepth - wallThickness * 2
  const geometries: THREE.BufferGeometry[] = []

  // X dividers (vertical walls running along depth)
  for (let i = 1; i < divisionsX; i++) {
    const xPos = -innerWidth / 2 + (innerWidth / divisionsX) * i
    const geom = new THREE.BoxGeometry(wallThickness, dividerHeight, innerDepth)
    geom.translate(xPos, GRIDFINITY.BASE_HEIGHT + dividerHeight / 2, 0)
    geometries.push(geom)
  }

  // Y dividers (horizontal walls running along width)
  for (let i = 1; i < divisionsY; i++) {
    const zPos = -innerDepth / 2 + (innerDepth / divisionsY) * i
    const geom = new THREE.BoxGeometry(innerWidth, dividerHeight, wallThickness)
    geom.translate(0, GRIDFINITY.BASE_HEIGHT + dividerHeight / 2, zPos)
    geometries.push(geom)
  }

  return geometries
}

/** Create stacking lip geometry — a stepped rim on the top outer edge of the bin */
function createStackingLipGeometry(
  binWidth: number,
  binDepth: number,
  totalHeight: number,
  borderRadius: number
): THREE.BufferGeometry[] {
  const lipWidth = 1.8 // total lip width
  const lipHeight = 2.6 // total lip height above wall top
  const stepHeight1 = 0.8
  const stepHeight2 = lipHeight - stepHeight1
  const stepWidth1 = lipWidth
  const stepWidth2 = lipWidth * 0.6

  const geometries: THREE.BufferGeometry[] = []

  // Lower step: full lip width, shorter
  const outer1 = createRoundedRectShape(binWidth, binDepth, borderRadius)
  const inner1Width = binWidth - stepWidth1 * 2
  const inner1Depth = binDepth - stepWidth1 * 2
  const inner1Radius = Math.max(0, borderRadius - stepWidth1)
  const inner1 = createRoundedRectShape(inner1Width, inner1Depth, inner1Radius)
  outer1.holes.push(inner1)

  const step1 = new THREE.ExtrudeGeometry(outer1, { depth: stepHeight1, bevelEnabled: false })
  step1.rotateX(-Math.PI / 2)
  step1.translate(0, totalHeight, 0)
  geometries.push(step1)

  // Upper step: narrower, taller
  const outer2 = createRoundedRectShape(binWidth - (stepWidth1 - stepWidth2) * 2, binDepth - (stepWidth1 - stepWidth2) * 2, Math.max(0, borderRadius - (stepWidth1 - stepWidth2)))
  const inner2Width = binWidth - stepWidth1 * 2
  const inner2Depth = binDepth - stepWidth1 * 2
  const inner2Radius = Math.max(0, borderRadius - stepWidth1)
  const inner2 = createRoundedRectShape(inner2Width, inner2Depth, inner2Radius)
  outer2.holes.push(inner2)

  const step2 = new THREE.ExtrudeGeometry(outer2, { depth: stepHeight2, bevelEnabled: false })
  step2.rotateX(-Math.PI / 2)
  step2.translate(0, totalHeight + stepHeight1, 0)
  geometries.push(step2)

  return geometries
}

export function createBinForCell(
  cell: LayoutCell,
  config: BinCellConfig,
  gridContext?: GridContext
): THREE.BufferGeometry {
  const csX = gridContext?.cellSizeX ?? GRIDFINITY.CELL_SIZE
  const csY = gridContext?.cellSizeY ?? GRIDFINITY.CELL_SIZE

  const binConfig: GridfinityConfig = {
    gridX: cell.spanX,
    gridY: cell.spanY,
    heightUnits: config.heightUnits,
    borderRadius: config.borderRadius,
    modelType: 'bin',
  }

  const binCellSizes: CellSizes = { cellSizeX: csX, cellSizeY: csY }
  let geometry = createBinGeometry(binConfig, binCellSizes)

  // Add internal divider walls if divisions > 1
  const divisionsX = cell.divisionsX ?? 1
  const divisionsY = cell.divisionsY ?? 1
  if (divisionsX > 1 || divisionsY > 1) {
    const binWidth = cell.spanX * csX
    const binDepth = cell.spanY * csY
    const wallHeight = config.heightUnits * GRIDFINITY.HEIGHT_UNIT - GRIDFINITY.BASE_HEIGHT
    if (wallHeight > 0) {
      const dividers = createDividerGeometries(
        binWidth, binDepth, wallHeight, divisionsX, divisionsY
      )
      if (dividers.length > 0) {
        const merged = mergeGeometries([geometry, ...dividers])
        if (merged) geometry = merged
      }
    }
  }

  // Add stacking lip (default: true)
  const stackingLip = cell.stackingLip !== false
  if (stackingLip) {
    const binWidth = cell.spanX * csX
    const binDepth = cell.spanY * csY
    const totalHeight = config.heightUnits * GRIDFINITY.HEIGHT_UNIT
    const lipGeometries = createStackingLipGeometry(binWidth, binDepth, totalHeight, config.borderRadius)
    if (lipGeometries.length > 0) {
      const merged = mergeGeometries([geometry, ...lipGeometries])
      if (merged) geometry = merged
    }
  }

  if (gridContext) {
    const totalWidth = gridContext.gridUnitsX * csX
    const totalDepth = gridContext.gridUnitsY * csY

    const cellCenterX =
      -(totalWidth / 2) +
      cell.gridX * csX +
      (cell.spanX * csX) / 2
    const cellCenterZ =
      -(totalDepth / 2) +
      cell.gridY * csY +
      (cell.spanY * csY) / 2

    geometry.translate(cellCenterX, 0, cellCenterZ)
  }

  return geometry
}
