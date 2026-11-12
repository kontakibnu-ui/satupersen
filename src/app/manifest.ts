import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/lib/theme";

/**
 * Makes the app installable on a phone's home screen (DESIGN.md §5). There is no
 * offline mode in the MVP, so there is no service worker.
 *
 * A manifest can only hold literal colours, so these two are the `background`
 * token from DESIGN.md §3 in light mode; the per-mode colour of the browser bar
 * is set in the viewport of the root layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Satu Persen",
    short_name: "Satu Persen",
    description: "Tulis harimu, lihat analisa dan progresmu.",
    lang: "id",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
