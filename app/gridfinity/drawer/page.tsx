'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const DrawerLayoutGenerator = dynamic(
  () =>
    import('@/components/gridfinity/DrawerLayoutGenerator').then((mod) => ({
      default: mod.DrawerLayoutGenerator,
    })),
  {
    ssr: false,
    loading: () => <LoadingState />,
  }
)

function LoadingState() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full animate-pulse">
      <div className="flex-1 min-h-[500px] bg-zinc-800 rounded-xl" />
      <div className="w-full lg:w-80 bg-zinc-800 rounded-xl min-h-[500px]" />
    </div>
  )
}

export default function DrawerPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-3rem)]">
        <Suspense fallback={<LoadingState />}>
          <DrawerLayoutGenerator />
        </Suspense>
      </div>
    </main>
  )
}
