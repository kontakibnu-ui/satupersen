import { FAQ, FEATURES, PRIVACY_POINTS, STEPS } from "@/app/_landing/content";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * /llms.txt (GEO): a plain Markdown summary that AI assistants and answer
 * engines can read without running the page, in the shape proposed at
 * llmstxt.org. Apart from the one-line summary, every sentence comes from the
 * landing page's own content (app/_landing/content.ts), so the
 * two can never say different things.
 */
export const dynamic = "force-static";

function body(): string {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Aplikasi web berbahasa Indonesia untuk menulis jurnal harian, mencatat kebiasaan, mood, energi, dan uang, lalu melihat analisa AI beserta perkembangan dari hari ke hari.",
    "",
    "## Cara kerja",
    ...STEPS.map((step) => `- ${step.title}: ${step.detail}`),
    "",
    "## Yang ikut dicatat",
    ...FEATURES.map((feature) => `- ${feature.label}: ${feature.consequence}`),
    "",
    "## Privasi",
    ...PRIVACY_POINTS.map((point) => `- ${point}`),
    "",
    "## Tanya jawab",
    ...FAQ.flatMap((item) => [`### ${item.question}`, item.answer, ""]),
    "## Halaman",
    `- [Beranda](${absoluteUrl("/")}): penjelasan produk, harga, dan tanya jawab`,
    `- [Kebijakan privasi](${absoluteUrl("/privacy")})`,
    `- [Syarat layanan](${absoluteUrl("/terms")})`,
    "",
  ];

  return lines.join("\n");
}

export function GET() {
  return new Response(body(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
