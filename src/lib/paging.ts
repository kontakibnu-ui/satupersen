/** PostgREST answers at most 1000 rows per request, so a longer read goes in pages. */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Reads every row of a query by asking for one page after another. `fetchPage`
 * must order its query on a stable key, otherwise rows can repeat or go missing
 * between pages.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Page<T>,
  failureMessage: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(failureMessage);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}
