import { z } from "zod";

/**
 * zod for code that runs in the browser. zod 4 compiles object parsers with
 * `new Function` when the page allows it, and finds out by trying once when a
 * `z.object` is built. The production content security policy forbids eval,
 * so that caught probe still shows up as a `script-src` violation on every page
 * that builds a schema in the browser (TASKS.md P.10). `jitless` skips the probe
 * and the compiled fast path; parsing stays the same and the objects parsed in
 * the browser are small.
 *
 * Imports are evaluated before the importing module's body, so a module that
 * takes `z` from here builds its schemas after this setting is in place. Browser
 * modules import `z` from here, never from "zod" (checked in zod.test.ts).
 */
z.config({ jitless: true });

export { z };
