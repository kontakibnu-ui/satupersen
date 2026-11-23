import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

/**
 * Crawlers (search engines and AI assistants alike) may read the public pages.
 * The app itself is personal and only redirects a crawler to the login form,
 * so those paths are closed to save their time. The login screens stay open to
 * crawling on purpose: their noindex tag only works when it can be read.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/today",
        "/habits",
        "/learn",
        "/expenses",
        "/dashboard",
        "/history",
        "/reports",
        "/settings",
        "/onboarding",
        "/read/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl().origin,
  };
}
