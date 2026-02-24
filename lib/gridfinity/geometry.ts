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

function addMagnetHoles(
  geometry: THREE.BufferGeometry,
  config: GridfinityConfig,
  cellSizes?: CellSizes
): THREE.BufferGeometry {
  if (!config.magnetHoles) return geometry

  const csX = cellSizes?.cellSizeX ?? GRIDFINITY.CELL_SIZE
  const csY = cellSizes?.cellSizeY ?? GRIDFINITY.CELL_SIZE
  const dims = calculateDimensions(config, cellSizes)
  const holeRadius = GRIDFINITY.MAGNET_HOLE_DIAMETER / 2
  const holeDepth = GRIDFINITY.MAGNET_HOLE_DEPTH

  const holes: THREE.BufferGeometry[] = []
  const cylinderGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeDepth, 16)
  cylinderGeom.rotateX(Math.PI / 2)
  cylinderGeom.translate(0, 0, -holeDepth / 2)

  for (let x = 0; x < config.gridX; x++) {
    for (let y = 0; y < config.gridY; y++) {
      const cellCenterX = -dims.width / 2 + csX / 2 + x * csX
      const cellCenterZ = -dims.depth / 2 + csY / 2 + y * csY
      // Inset from cell edge: use smaller of the two cell sizes for consistent inset
      const insetX = csX / 2 - 4
      const insetY = csY / 2 - 4

      const corners = [
        [cellCenterX - insetX, cellCenterZ - insetY],
        [cellCenterX + insetX, cellCenterZ - insetY],
        [cellCenterX - insetX, cellCenterZ + insetY],
        [cellCenterX + insetX, cellCenterZ + insetY],
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

export function createBaseplateGeometry(config: GridfinityConfig, cellSizes?: CellSizes): THREE.BufferGeometry {
  const dims = calculateDimensions(config, cellSizes)
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

  return addMagnetHoles(geometry, config, cellSizes)
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
  magnetHoles: boolean
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
    magnetHoles: config.magnetHoles,
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
  scoop?: boolean
  labelTab?: boolean
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

/** Create scoop ramp geometry — a concave curve on the front (+Z) interior wall of each compartment */
function createScoopGeometry(
  binWidth: number,
  binDepth: number,
  wallHeight: number,
  divisionsX: number,
  divisionsY: number
): THREE.BufferGeometry[] {
  const wallThickness = GRIDFINITY.WALL_THICKNESS
  const innerWidth = binWidth - wallThickness * 2
  const innerDepth = binDepth - wallThickness * 2
  const geometries: THREE.BufferGeometry[] = []

  const compartmentWidth = innerWidth / divisionsX
  const compartmentDepth = innerDepth / divisionsY
  const scoopRadius = Math.min(wallHeight * 0.65, compartmentDepth * 0.9)
  const segments = 16

  for (let col = 0; col < divisionsX; col++) {
    for (let row = 0; row < divisionsY; row++) {
      // Front wall (+Z side) of each compartment
      const compartmentCenterX = -innerWidth / 2 + compartmentWidth * (col + 0.5)
      const compartmentFrontZ = -innerDepth / 2 + compartmentDepth * (row + 1)

      const scoopWidth = compartmentWidth - wallThickness
      const halfW = scoopWidth / 2

      // Build scoop as a curved surface from the base floor up the front wall
      // Quarter-circle arc in YZ plane, extruded across X
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []

      // Generate vertices: (segments+1) rows along arc, 2 columns (left/right edges)
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const angle = (t * Math.PI) / 2 // 0 to PI/2
        const y = GRIDFINITY.BASE_HEIGHT + scoopRadius * (1 - Math.cos(angle))
        const z = compartmentFrontZ - scoopRadius * Math.sin(angle)
        // Normal points inward (toward -Z and upward)
        const ny = Math.sin(angle)
        const nz = -Math.cos(angle)

        // Left vertex
        positions.push(compartmentCenterX - halfW, y, z)
        normals.push(0, ny, nz)
        // Right vertex
        positions.push(compartmentCenterX + halfW, y, z)
        normals.push(0, ny, nz)
      }

      // Generate triangle indices
      for (let i = 0; i < segments; i++) {
        const bl = i * 2
        const br = i * 2 + 1
        const tl = (i + 1) * 2
        const tr = (i + 1) * 2 + 1

        indices.push(bl, br, tl)
        indices.push(br, tr, tl)
      }

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      geom.setIndex(indices)
      geometries.push(geom)
    }
  }

  return geometries
}

/** Create label tab geometry — small protruding tabs on the front top edge, one per column */
function createLabelTabGeometry(
  binWidth: number,
  binDepth: number,
  totalHeight: number,
  divisionsX: number
): THREE.BufferGeometry[] {
  const wallThickness = GRIDFINITY.WALL_THICKNESS
  const innerWidth = binWidth - wallThickness * 2
  const compartmentWidth = innerWidth / divisionsX

  const tabWidth = Math.min(12, compartmentWidth * 0.8) // 12mm or 80% of compartment
  const tabHeight = 3
  const tabThickness = 1.5

  const geometries: THREE.BufferGeometry[] = []

  for (let col = 0; col < divisionsX; col++) {
    const compartmentCenterX = -innerWidth / 2 + compartmentWidth * (col + 0.5)
    // Front edge of bin (+Z side), protruding outward
    const tabZ = binDepth / 2 + tabThickness / 2
    const tabY = totalHeight + tabHeight / 2

    const geom = new THREE.BoxGeometry(tabWidth, tabHeight, tabThickness)
    geom.translate(compartmentCenterX, tabY, tabZ)
    geometries.push(geom)
  }

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
    magnetHoles: false,
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

  // Add scoop ramp (default: false)
  if (cell.scoop) {
    const binWidth = cell.spanX * csX
    const binDepth = cell.spanY * csY
    const wallHeight = config.heightUnits * GRIDFINITY.HEIGHT_UNIT - GRIDFINITY.BASE_HEIGHT
    if (wallHeight > 0) {
      const scoopGeometries = createScoopGeometry(binWidth, binDepth, wallHeight, divisionsX, divisionsY)
      if (scoopGeometries.length > 0) {
        const merged = mergeGeometries([geometry, ...scoopGeometries])
        if (merged) geometry = merged
      }
    }
  }

  // Add label tabs (default: false)
  if (cell.labelTab) {
    const binWidth = cell.spanX * csX
    const binDepth = cell.spanY * csY
    const totalHeight = config.heightUnits * GRIDFINITY.HEIGHT_UNIT
    const tabGeometries = createLabelTabGeometry(binWidth, binDepth, totalHeight, divisionsX)
    if (tabGeometries.length > 0) {
      const merged = mergeGeometries([geometry, ...tabGeometries])
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
