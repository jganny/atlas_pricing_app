import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
});

export const metadata: Metadata = {
  title: "Atlas Pricing",
  description: "Atlas Logistics pricing desks — quote, inbox, carriers",
  // Explicit /app prefix: Next metadata basePath prefixing is unreliable with static export.
  manifest: "/app/manifest.webmanifest",
  applicationName: "Atlas Pricing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Atlas",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#0a2540",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlex.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
