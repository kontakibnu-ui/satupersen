import { unstable_rethrow } from "next/navigation";

/**
 * Calling a server action from the browser.
 *
 * A server action is a fetch under the hood. When the connection drops, the
 * server crashes before it answers, or a new deploy replaced the action, the
 * promise rejects instead of returning a result, and a caller that only reads
 * `result.ok` stays busy forever without a word. This turns that rejection into
 * an ordinary failure the screen already knows how to show.
 *
 * `redirect()` and `notFound()` inside an action reject the same way on the
 * client, and Next.js needs them to reach its boundaries, so they are thrown
 * again untouched.
 */

export const CONNECTION_MESSAGE = "Koneksi terputus. Coba lagi.";

/** `connectionLost` tells this apart from a refusal the action itself returned. */
export type ConnectionFailure = { ok: false; message: string; retryable: true; connectionLost: true };

export async function callAction<T>(action: () => Promise<T>): Promise<T | ConnectionFailure> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: CONNECTION_MESSAGE, retryable: true, connectionLost: true };
  }
}
