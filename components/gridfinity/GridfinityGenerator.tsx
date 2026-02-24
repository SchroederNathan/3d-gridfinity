'use client'

import { GridfinityProvider } from './GridfinityContext'
import { GridfinityViewer } from './GridfinityViewer'
import { GridfinityControls } from './GridfinityControls'

export function GridfinityGenerator() {
  return (
    <GridfinityProvider>
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        <div className="flex-1 min-h-[400px] lg:min-h-0">
          <GridfinityViewer />
        </div>

        <div className="w-full lg:w-80 space-y-6 p-6 bg-white rounded-lg shadow-sm border border-neutral-200">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-neutral-900">Gridfinity Generator</h2>
            <p className="text-sm text-neutral-500">Configure and export your 3D printable model</p>
          </div>

          <div className="space-y-6">
            <GridfinityControls.ModelType />
            <GridfinityControls.GridSize />
            <GridfinityControls.CellHeight />
            <GridfinityControls.BorderRadius />
            <GridfinityControls.MagnetHoles />
          </div>

          <div className="pt-4 border-t border-neutral-200 space-y-4">
            <GridfinityControls.Dimensions />
            <GridfinityControls.Export />
          </div>
        </div>
      </div>
    </GridfinityProvider>
  )
}
