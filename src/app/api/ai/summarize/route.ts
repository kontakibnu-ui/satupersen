import { NextResponse } from "next/server";
import { z } from "zod";
import { summarizeUserDay, type SummaryOutcome } from "@/lib/ai/summarize-day";
import { todayKey } from "@/lib/dates";
import { rateLimitMessage, takeAiRateLimit } from "@/lib/rate-limit";
import { getActionContext } from "@/lib/session";

/**
 * POST /api/ai/summarize (AI-1 to AI-5).
 *
 * The screen sends the date it was opened for, and the server checks it is
 * still today by the profile's time zone ("Analisa hari ini"). The text, the
 * profile, and the previous scores are read in summarizeUserDay, because a
 * client can be edited (PRD.md §7). The response carries only what the screen
 * shows: never the model id, never a stack trace, and never another user's data.
 *
 * Regen quota (AI-4): the first summary of a day is always allowed, and after
 * that free accounts get 1 more attempt while premium gets 3. The same function
 * serves the WhatsApp command and the automatic summary, so the quota is shared.
 *
 * Rate limit (RATE-1): at most 5 taps a minute per user reach the model, so a
 * burst of requests cannot slip past the quota before it is counted.
 */

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type SummarizeResponse = Exclude<SummaryOutcome, { kind: "error" }> | { kind: "error"; message: string };

const fail = (status: number, message: string) =>
  NextResponse.json<SummarizeResponse>({ kind: "error", message }, { status });

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return fail(400, "Tanggalnya tidak dikenali. Coba muat ulang halaman ini.");
  }

  const context = await getActionContext();

  if (!context) {
    return fail(401, "Sesi kamu sudah berakhir. Masuk lagi dulu.");
  }

  if (parsedBody.data.date !== todayKey(context.timeZone)) {
    return fail(409, "Hari sudah berganti. Muat ulang halaman ini untuk menganalisa hari ini.");
  }

  // RATE-1: taps in quick succession wait here, before any quota or model work.
  // Only the web button counts; the WhatsApp command has its own flood limit and
  // the 22:00 automatic summary is not a tap.
  const wait = await takeAiRateLimit(context.userId);

  if (wait > 0) {
    // Retry-After tells the screen that, unlike a used up quota, trying again later helps.
    return NextResponse.json<SummarizeResponse>(
      { kind: "error", message: rateLimitMessage(wait) },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const outcome = await summarizeUserDay({
    reader: context.supabase,
    userId: context.userId,
    timeZone: context.timeZone,
    plan: context.plan,
    date: parsedBody.data.date,
  });

  if (outcome.kind === "error") {
    return fail(outcome.status, outcome.message);
  }

  return NextResponse.json<SummarizeResponse>(outcome);
}
