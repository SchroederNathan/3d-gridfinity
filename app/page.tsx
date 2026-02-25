import { Suspense } from 'react'
import type { Metadata } from 'next'
import DrawerLayoutClient from './drawer-layout-client'

export const metadata: Metadata = {
  title: 'Gridfinity Generator — Free 3D Drawer Layout Tool with STL Export',
  description:
    'Design custom Gridfinity drawer layouts in 3D. Drag, resize, and arrange bins visually, then export STL files for 3D printing. Free, open-source, no sign-up required.',
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-zinc-950" />}>
      <DrawerLayoutClient />
    </Suspense>
  )
}
