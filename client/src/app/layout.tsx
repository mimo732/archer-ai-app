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
  title: "ARCHER AI — Personal Jarvis Assistant",
  description:
    "A Jarvis-style voice AI assistant with particle core HUD, agent actions, memory, tasks and live news. Just like Iron Man's JARVIS.",
  keywords: ["ARCHER AI", "Jarvis", "AI assistant", "voice assistant", "Iron Man", "AI agent"],
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
    title: "ARCHER AI",
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
    <html lang="en" suppressHydrationWarning className="dark">
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
