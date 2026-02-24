export const GRIDFINITY = {
  CELL_SIZE: 42,
  HEIGHT_UNIT: 7,
  BASE_HEIGHT: 5,
  WALL_THICKNESS: 1.2,
  FILLET_BOTTOM: 0.8,
  FILLET_TOP: 1.6,
  MAGNET_HOLE_DIAMETER: 6.5,
  MAGNET_HOLE_DEPTH: 2.4,
  TOLERANCE: 0.5,
} as const

export const LIMITS = {
  GRID_MIN: 1,
  GRID_MAX: 10,
  HEIGHT_MIN: 1,
  HEIGHT_MAX: 10,
  BORDER_RADIUS_MIN: 0,
  BORDER_RADIUS_MAX: 5,
} as const

export type GridfinityConfig = {
  gridX: number
  gridY: number
  heightUnits: number
  borderRadius: number
  modelType: 'baseplate' | 'bin'
  magnetHoles: boolean
}

export const DEFAULT_CONFIG: GridfinityConfig = {
  gridX: 2,
  gridY: 2,
  heightUnits: 3,
  borderRadius: 0.8,
  modelType: 'bin',
  magnetHoles: false,
}
