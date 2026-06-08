import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Cinzel, Inter } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Falkenwacht",
  description: "AI-powered D&D 5e Visual Novel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`h-dvh overflow-hidden ${cinzel.variable} ${inter.variable}`} suppressHydrationWarning>{children}</body>
    </html>
  );
}