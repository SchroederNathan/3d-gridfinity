'use client'

import dynamic from 'next/dynamic'

const DrawerLayoutGenerator = dynamic(
  () =>
    import('@/components/gridfinity/DrawerLayoutGenerator').then((mod) => ({
      default: mod.DrawerLayoutGenerator,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen bg-zinc-950 animate-pulse" />
    ),
  }
)

export default function DrawerLayoutClient() {
  return <DrawerLayoutGenerator />
}
