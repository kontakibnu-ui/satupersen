import type { Metadata, Viewport } from "next";
import { Lora, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-toggle";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { parseTheme, THEME_COLOR, THEME_COOKIE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

// DESIGN.md §4 (version 4): Plus Jakarta Sans for the interface and titles,
// Lora for what is written on the paper (the diary, the cue, the analysis).
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-lora",
});

// The wordmark only ("Satu Persen."), decided by the user on 2026-11-10. The
// optical-size axis keeps the letters crisp at header size and at footer size.
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-newsreader",
});

// SEO: every relative address in metadata (canonical, Open Graph) resolves
// against the public address in src/lib/site.ts.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_NAME,
  description: "Tulis harimu, lihat analisa dan progresmu.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", locale: "id_ID", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

async function readTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// DESIGN.md §5: the layout must survive notches and home indicators, and the
// browser bar takes the colour of the mode the page is painted in.
export async function generateViewport(): Promise<Viewport> {
  return {
    viewportFit: "cover",
    themeColor: THEME_COLOR[await readTheme()],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readTheme();

  return (
    <html lang="id" className={cn(plusJakartaSans.variable, lora.variable, newsreader.variable, theme === "dark" && "dark")}>
      <body className="min-h-dvh bg-background text-text">
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
