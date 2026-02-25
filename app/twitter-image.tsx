import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const alt =
  'Gridfinity Generator — Free 3D Drawer Layout Tool with STL Export'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const iconData = await readFile(
    join(process.cwd(), 'public/favicons/android-chrome-512x512.png')
  )
  const iconBase64 = `data:image/png;base64,${iconData.toString('base64')}`

  // 5x6 grid with some merged cells for visual interest
  const cells = [
    { r: 0, c: 0, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 0, c: 1, w: 2, h: 1, color: 'rgba(16, 185, 129, 0.3)', border: '#10b981' },
    { r: 0, c: 3, w: 1, h: 2, color: 'rgba(59, 130, 246, 0.25)', border: '#3b82f6' },
    { r: 0, c: 4, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 0, c: 5, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 1, c: 0, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 1, c: 1, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 1, c: 2, w: 1, h: 1, color: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6' },
    { r: 1, c: 4, w: 2, h: 2, color: 'rgba(16, 185, 129, 0.2)', border: '#10b981' },
    { r: 2, c: 0, w: 3, h: 1, color: 'rgba(16, 185, 129, 0.3)', border: '#10b981' },
    { r: 2, c: 3, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 3, c: 0, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 3, c: 1, w: 1, h: 2, color: 'rgba(59, 130, 246, 0.25)', border: '#3b82f6' },
    { r: 3, c: 2, w: 2, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 3, c: 4, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 3, c: 5, w: 1, h: 1, color: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6' },
    { r: 4, c: 0, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 4, c: 2, w: 1, h: 1, color: '#18181b', border: '#3f3f46' },
    { r: 4, c: 3, w: 3, h: 1, color: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
  ]

  const cellSize = 64
  const gap = 4

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left side — branding */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px',
            width: '50%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <img
              src={iconBase64}
              width={56}
              height={56}
              style={{ borderRadius: '12px' }}
            />
          </div>

          <div
            style={{
              fontSize: '52px',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex' }}>Gridfinity</div>
            <div style={{ display: 'flex' }}>Generator</div>
          </div>

          <div
            style={{
              fontSize: '22px',
              color: '#a1a1aa',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex' }}>
              Design custom drawer layouts in 3D.
            </div>
            <div style={{ display: 'flex' }}>
              Export STL files for 3D printing.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '32px',
            }}
          >
            {['3D Preview', 'STL Export', 'Open Source'].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27272a',
                  borderRadius: '8px',
                  fontSize: '15px',
                  color: '#d4d4d8',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Right side — grid layout visual */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: `${6 * cellSize + 5 * gap}px`,
              height: `${5 * cellSize + 4 * gap}px`,
            }}
          >
            {cells.map((cell, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${cell.c * (cellSize + gap)}px`,
                  top: `${cell.r * (cellSize + gap)}px`,
                  width: `${cell.w * cellSize + (cell.w - 1) * gap}px`,
                  height: `${cell.h * cellSize + (cell.h - 1) * gap}px`,
                  backgroundColor: cell.color,
                  border: `2px solid ${cell.border}`,
                  borderRadius: '8px',
                  display: 'flex',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
