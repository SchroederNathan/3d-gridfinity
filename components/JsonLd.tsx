export function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Gridfinity Generator",
    description:
      "Design custom Gridfinity drawer layouts in 3D. Drag, resize, and arrange bins visually, then export STL files for 3D printing.",
    url: "https://gridfinity.nathanschroeder.ca",
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern browser with WebGL support",
    featureList: [
      "3D drawer layout visualization",
      "Drag and resize gridfinity bins",
      "STL file export for 3D printing",
      "Custom baseplate dimensions",
      "Configurable bin heights and wall thickness",
    ],
    screenshot: "https://gridfinity.nathanschroeder.ca/opengraph-image",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Nathan Schroeder",
      url: "https://nathanschroeder.ca",
    },
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
    >
      {JSON.stringify(structuredData)}
    </script>
  )
}
