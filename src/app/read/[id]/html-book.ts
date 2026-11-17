import DOMPurify from "dompurify";
import { escapeHtml, textToHtml } from "@/lib/books/rules";

/**
 * DOCX and TXT books for the reader (PRD.md READ-3). foliate-js reads EPUB and
 * PDF itself; for these two the file is turned into HTML here and handed over as
 * a "book" object (the interface its view.js reads: sections that load a URL,
 * plus the two helpers that let it measure progress). Browser only.
 *
 * The HTML is untrusted: Word's converter keeps whatever the document holds, so
 * it goes through DOMPurify, links leaving the book lose their address, and the
 * reader page's nonce policy blocks scripts on top (READ-8).
 */

/** Long documents are cut into parts so the paginator never lays out one huge page. */
const SECTION_CHARACTERS = 60_000;

type Section = {
  id: string;
  linear: "yes";
  size: number;
  load: () => string;
  unload: () => void;
  createDocument: () => Document;
};

export type HtmlBook = {
  book: {
    dir: "ltr";
    metadata: { title: string; language: string };
    toc: never[];
    pageList: never[];
    sections: Section[];
    splitTOCHref: (href: string) => [number, null];
    getTOCFragment: (doc: Document) => Element;
    resolveHref: (href: string) => { index: number };
    isExternal: (uri: string) => boolean;
  };
  /** Frees the object URLs the sections made. */
  release: () => void;
};

function page(body: string, title: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="id"><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    "</head><body>",
    body,
    "</body></html>",
  ].join("\n");
}

const sectionIndex = (href: string) => Math.max(0, Number.parseInt(href, 10) || 0);

/** Splits an HTML document's body into parts and wraps them as a foliate-js book. */
export function htmlBook(html: string, title: string): HtmlBook {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];
  let current = "";

  for (const node of Array.from(parsed.body.childNodes)) {
    const piece =
      node.nodeType === Node.ELEMENT_NODE ? (node as Element).outerHTML : escapeHtml(node.textContent ?? "");

    if (current !== "" && current.length + piece.length > SECTION_CHARACTERS) {
      parts.push(current);
      current = "";
    }

    current += piece;
  }

  if (current !== "" || parts.length === 0) {
    parts.push(current);
  }

  const urls: string[] = [];
  const sections = parts.map((body, index): Section => {
    const document = page(body, title);
    let url: string | null = null;

    return {
      id: `bagian-${index}`,
      linear: "yes",
      size: document.length,
      load: () => {
        if (!url) {
          url = URL.createObjectURL(new Blob([document], { type: "text/html" }));
          urls.push(url);
        }

        return url;
      },
      unload: () => {},
      createDocument: () => new DOMParser().parseFromString(document, "text/html"),
    };
  });

  return {
    book: {
      dir: "ltr",
      metadata: { title, language: "id" },
      toc: [],
      pageList: [],
      sections,
      splitTOCHref: (href) => [sectionIndex(href), null],
      getTOCFragment: (doc) => doc.documentElement,
      resolveHref: (href) => ({ index: sectionIndex(href) }),
      isExternal: (uri) => /^\w+:/i.test(uri),
    },
    release: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

/** A Word document as clean HTML: no scripts, styles, forms, frames, or outbound links. */
export async function docxBook(file: Blob, title: string): Promise<HtmlBook> {
  const { default: mammoth } = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { externalFileAccess: false });

  const clean = DOMPurify.sanitize(value, {
    FORBID_TAGS: ["style", "script", "iframe", "frame", "object", "embed", "form", "input", "button", "link", "meta", "base", "svg", "math"],
    FORBID_ATTR: ["style", "srcset"],
    ALLOW_DATA_ATTR: false,
  });
  const parsed = new DOMParser().parseFromString(clean, "text/html");

  for (const link of Array.from(parsed.body.querySelectorAll("a[href]"))) {
    if (!link.getAttribute("href")?.startsWith("#")) {
      link.removeAttribute("href");
    }
  }

  return htmlBook(parsed.body.innerHTML, title);
}

/** A plain text file; every character is escaped before it becomes HTML. */
export async function textBook(file: Blob, title: string): Promise<HtmlBook> {
  return htmlBook(textToHtml(await file.text(), title), title);
}
