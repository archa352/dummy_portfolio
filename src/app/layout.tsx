import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether 1 Earbuds",
  description: "A powerful web experience for the Aether 1 Earbuds, by OFF+BRAND.",
  icons: { icon: "/sites/aether1/images/favicon.png" },
  openGraph: {
    title: "Aether 1 Earbuds",
    description: "A powerful web experience for the Aether 1 Earbuds, by OFF+BRAND.",
    images: ["/sites/aether1/images/opengraph.webp"],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
