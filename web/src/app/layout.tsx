import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";
import { CHAT_APP_NAME, CHAT_CLIENT_NAME, IS_CHAT_APP } from "@/lib/chat-app-mode";

// The Vertex Chat build is a site of its own (root address); the Pricing app lives under /app.
const P = IS_CHAT_APP ? "" : "/app";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
});

export const metadata: Metadata = {
  title: IS_CHAT_APP ? CHAT_APP_NAME : "Atlas Pricing",
  description: IS_CHAT_APP ? `Work chat for ${CHAT_CLIENT_NAME} staff` : "Atlas Logistics pricing desks — quote, inbox, carriers",
  // Explicit /app prefix: Next metadata basePath prefixing is unreliable with static export.
  manifest: `${P}/manifest.webmanifest`,
  applicationName: IS_CHAT_APP ? CHAT_APP_NAME : "Atlas Pricing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: IS_CHAT_APP ? CHAT_APP_NAME : "Atlas",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${P}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${P}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${P}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#323843",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlex.variable} h-full`}>
      <head>
        {/* Open the connections to the database and sign-in servers while the page code is still loading. */}
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="" />
      </head>
      <body className="min-h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
