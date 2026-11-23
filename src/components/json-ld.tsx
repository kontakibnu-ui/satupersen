/**
 * Structured data for search engines and AI assistants (schema.org as JSON-LD),
 * the way the Next.js guide renders it. Only our own fixed text goes in here,
 * never user content; `<` is escaped so the payload cannot close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
