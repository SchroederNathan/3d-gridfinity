import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JsonLd } from "@/components/JsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Gridfinity Generator — Free 3D Drawer Layout Tool with STL Export",
    template: "%s | Gridfinity Generator",
  },
  description:
    "Design custom Gridfinity drawer layouts in 3D. Drag, resize, and arrange bins visually, then export STL files for 3D printing. Free, open-source, no sign-up required.",
  keywords: [
    "gridfinity",
    "gridfinity generator",
    "gridfinity drawer",
    "gridfinity layout",
    "gridfinity bin",
    "gridfinity baseplate",
    "3D printing",
    "STL export",
    "drawer organizer",
    "tool organization",
  ],
  authors: [{ name: "Nathan Schroeder" }],
  creator: "Nathan Schroeder",
  metadataBase: new URL("https://gridfinity.nathanschroeder.ca"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Gridfinity Generator",
    title: "Gridfinity Generator — Free 3D Drawer Layout Tool",
    description:
      "Design custom Gridfinity drawer layouts in 3D. Drag, resize, and arrange bins visually, then export STL files for 3D printing.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gridfinity Generator — Free 3D Drawer Layout Tool",
    description:
      "Design custom Gridfinity drawer layouts in 3D. Export STL files for 3D printing.",
  },
  icons: {
    icon: [
      { url: "/favicons/favicon.ico" },
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/favicons/apple-touch-icon.png" },
  },
  manifest: "/favicons/site.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <JsonLd />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
