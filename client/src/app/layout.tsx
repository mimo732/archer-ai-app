import type { Metadata, Viewport } from "next";
import { Orbitron } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "JARVIS — Assistant personnel",
  description:
    "Assistant vocal personnel JARVIS avec mémoire, tâches, actions et commandes d’appareils.",
  keywords: ["JARVIS", "assistant IA", "assistant vocal", "agent IA"],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JARVIS",
  },
};

export const viewport: Viewport = {
  themeColor: "#030603",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <body className={`${orbitron.variable} antialiased bg-[#030603] text-foreground`}>
        {children}
        {/* Universal device agent — activates ONLY inside the installed ARCHER
            apps (Electron / Capacitor). In a normal browser it is a no-op. */}
        <Script src="/agent-client.js" strategy="afterInteractive" />
        <Toaster />
      </body>
    </html>
  );
}
