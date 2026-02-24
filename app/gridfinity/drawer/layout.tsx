import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Drawer Layout Editor",
  description:
    "Design custom Gridfinity drawer layouts with a visual 3D editor. Set drawer dimensions, arrange bins, resize cells, and export STL files for 3D printing.",
}

export default function DrawerLayout({ children }: { children: React.ReactNode }) {
  return children
}
