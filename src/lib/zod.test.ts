import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "@/lib/zod";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const importsZodDirectly = (code: string) => /from\s+["']zod["']/.test(code);

/** "@/lib/books/draft" → src/lib/books/draft.ts (or .tsx), when it exists. */
function resolveAlias(specifier: string, files: Set<string>): string | null {
  const base = join(SRC, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`].find((candidate) => files.has(candidate)) ?? null;
}

describe("zod in the browser (TASKS.md P.10)", () => {
  it("skips the eval probe that the content security policy reports", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("client components and the modules they import take z from @/lib/zod", () => {
    const files = sourceFiles(SRC);
    const known = new Set(files);
    const offenders = new Set<string>();

    for (const file of files) {
      const code = readFileSync(file, "utf8");

      if (!/^\s*["']use client["']/.test(code)) {
        continue;
      }

      if (importsZodDirectly(code)) {
        offenders.add(relative(SRC, file));
      }

      for (const match of code.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
        const imported = resolveAlias(match[1], known);

        if (!imported || imported.endsWith(join("lib", "zod.ts"))) {
          continue;
        }

        const importedCode = readFileSync(imported, "utf8");
        // A "use server" module reaches the browser only as action references, without its zod.
        const serverOnly = /^\s*["']use server["']/.test(importedCode);

        if (!serverOnly && importsZodDirectly(importedCode)) {
          offenders.add(relative(SRC, imported));
        }
      }
    }

    expect([...offenders]).toEqual([]);
  });
});
