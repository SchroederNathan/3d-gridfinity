import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gridfinity Bin Generator",
  description:
    "Generate custom Gridfinity bins and baseplates with an interactive 3D configurator. Adjust grid size, height, corner radius, and export STL files.",
}

export default function GridfinityLayout({ children }: { children: React.ReactNode }) {
  return children
}
