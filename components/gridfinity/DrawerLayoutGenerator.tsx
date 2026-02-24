'use client'

import { DrawerProvider } from './DrawerContext'
import { DrawerViewer } from './DrawerViewer'

export function DrawerLayoutGenerator() {
  return (
    <DrawerProvider>
      <DrawerViewer />
    </DrawerProvider>
  )
}
