import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Cinzel, Inter } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "AI Narrative DnD Visual Novel",
  description: "Mobile-first MVP demo for an AI-assisted DnD visual novel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`h-dvh overflow-hidden ${cinzel.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}