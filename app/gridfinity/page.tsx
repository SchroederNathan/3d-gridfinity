'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const GridfinityGenerator = dynamic(
  () => import('@/components/gridfinity').then(mod => ({ default: mod.GridfinityGenerator })),
  {
    ssr: false,
    loading: () => <LoadingState />,
  }
)

function LoadingState() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-pulse">
      <div className="flex-1 min-h-[400px] lg:min-h-0 bg-neutral-200 rounded-lg flex items-center justify-center">
        <div className="text-neutral-400 flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading 3D viewer...</span>
        </div>
      </div>
      <div className="w-full lg:w-80 bg-neutral-100 rounded-lg h-[500px]" />
    </div>
  )
}

export default function GridfinityPage() {
  return (
    <main className="min-h-screen bg-neutral-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)]">
        <Suspense fallback={<LoadingState />}>
          <GridfinityGenerator />
        </Suspense>
      </div>
    </main>
  )
}
