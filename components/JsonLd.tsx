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
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Nathan Schroeder",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
