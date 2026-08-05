import type { Metadata } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";

import "./globals.css";

const liberationMono = localFont({
  variable: "--font-liberation-mono",
  src: [
    { path: "../public/fonts/LiberationMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/LiberationMono-Italic.ttf", weight: "400", style: "italic" },
    { path: "../public/fonts/LiberationMono-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/LiberationMono-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "Muhasabah",
  description: "Self Tasks Tracking Dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${liberationMono.variable} h-full`}>
      <body className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
