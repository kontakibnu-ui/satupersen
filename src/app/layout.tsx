import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// DESIGN.md §4: Plus Jakarta Sans for UI, Newsreader for diary text and titles.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "Satu Persen",
  description: "Tulis harimu, lihat ringkasan dan progresmu.",
};

// DESIGN.md §5: the layout must survive notches and home indicators.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh bg-background text-text">{children}</body>
    </html>
  );
}

