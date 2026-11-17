/**
 * Copies of opened books in the browser's Cache Storage (PRD.md READ-9), so a
 * book opens again without downloading it from Storage. One cache per user, so
 * a shared phone never mixes accounts. Browser only.
 *
 * Cache Storage exists only on secure origins and can be blocked; every helper
 * then does nothing and the reader simply downloads the book each time.
 */

const PREFIX = "satupersen-books-";

const cacheName = (userId: string) => `${PREFIX}${userId}`;

/** A same-origin address used only as the key; nothing is ever fetched from it. */
const keyFor = (bookId: string) => new Request(`/reader-cache/${bookId}`);

const available = () => typeof window !== "undefined" && "caches" in window;

export async function cachedBook(userId: string, bookId: string): Promise<Blob | null> {
  if (!available()) {
    return null;
  }

  try {
    const cache = await caches.open(cacheName(userId));
    const response = await cache.match(keyFor(bookId));

    return response ? await response.blob() : null;
  } catch (error) {
    console.error("reading a cached book failed", { bookId, kind: (error as Error).name });
    return null;
  }
}

export async function storeBook(userId: string, bookId: string, file: Blob): Promise<void> {
  if (!available()) {
    return;
  }

  try {
    const cache = await caches.open(cacheName(userId));
    await cache.put(keyFor(bookId), new Response(file, { headers: { "content-type": file.type } }));
  } catch (error) {
    // Storage full or blocked: the book still opens, it just downloads next time.
    console.error("keeping a copy of a book failed", { bookId, kind: (error as Error).name });
  }
}

export async function forgetBook(userId: string, bookId: string): Promise<void> {
  if (!available()) {
    return;
  }

  try {
    const cache = await caches.open(cacheName(userId));
    await cache.delete(keyFor(bookId));
  } catch (error) {
    console.error("removing a cached book failed", { bookId, kind: (error as Error).name });
  }
}

/** Removes the copies of every other account on this browser (READ-9). */
export async function forgetOtherAccounts(userId: string): Promise<void> {
  if (!available()) {
    return;
  }

  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(PREFIX) && name !== cacheName(userId)).map((name) => caches.delete(name)),
    );
  } catch (error) {
    console.error("removing other accounts' cached books failed", { kind: (error as Error).name });
  }
}

/** Removes every book copy on this browser; used when the user signs out. */
export async function forgetAllBooks(): Promise<void> {
  if (!available()) {
    return;
  }

  try {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PREFIX)).map((name) => caches.delete(name)));
  } catch (error) {
    console.error("removing cached books failed", { kind: (error as Error).name });
  }
}
