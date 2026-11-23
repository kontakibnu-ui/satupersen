/**
 * The public address of Satu Persen and the words search engines and AI
 * assistants read about it (metadata, robots, sitemap, JSON-LD, /llms.txt).
 *
 * The domain is still an open decision (AGENTS.md §7), so the address comes from
 * NEXT_PUBLIC_APP_URL, then from the production domain Vercel sets on its own
 * (VERCEL_PROJECT_PRODUCTION_URL), and only then from localhost for development.
 */

export const SITE_NAME = "Satu Persen";

export const SITE_TITLE = "Satu Persen, jadi 1% lebih baik tiap hari";

export const SITE_DESCRIPTION =
  "Tulis harimu dalam beberapa kalimat. Satu Persen menganalisanya, memberi skor beserta alasannya, dan menunjukkan seberapa jauh kamu sudah bergerak.";

function parseUrl(value: string | undefined): URL | null {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    console.error("site address is not a valid URL, falling back", { variable: "NEXT_PUBLIC_APP_URL or VERCEL_PROJECT_PRODUCTION_URL" });
    return null;
  }
}

export function siteUrl(): URL {
  return (
    parseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    parseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    new URL("http://localhost:3000")
  );
}

/** An absolute address on this site, for places that do not accept a relative one. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}
