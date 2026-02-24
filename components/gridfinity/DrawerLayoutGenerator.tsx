'use client'

import { DrawerProvider } from './DrawerContext'
import { DrawerViewer } from './DrawerViewer'
import { DrawerLayoutEditor } from './DrawerLayoutEditor'
import { DrawerControls } from './DrawerControls'

export function DrawerLayoutGenerator() {
  return (
    <DrawerProvider>
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Layout Editor
              </h3>
              <span className="text-xs text-zinc-500">Click cells to select, drag handles to resize</span>
            </div>
            <DrawerLayoutEditor />
          </div>

          <div className="flex-1 min-h-[300px] bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <DrawerViewer />
          </div>
        </div>

        <div className="w-full lg:w-80 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-100">Drawer Layout</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Design your Gridfinity drawer layout
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <DrawerControls.DrawerSize />
            <DrawerControls.CellActions />

            <div className="h-px bg-zinc-800" />

            <DrawerControls.CellHeight />
            <DrawerControls.BorderRadius />
            <DrawerControls.MagnetHoles />
          </div>

          <div className="p-5 border-t border-zinc-800 space-y-4 bg-zinc-900/50">
            <DrawerControls.Summary />
            <DrawerControls.Export />
          </div>
        </div>
      </div>
    </DrawerProvider>
  )
}
