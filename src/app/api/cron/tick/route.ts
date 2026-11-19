import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { summarizeUserDay } from "@/lib/ai/summarize-day";
import { sweepOrphanBookFiles } from "@/lib/books/sweep";
import { meteredReport } from "@/lib/ai/usage";
import { runReports } from "@/lib/reports/run";
import { expireEndedPremiums } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAutoSummaries } from "@/lib/whatsapp/auto-summary";
import { isWhatsAppConfigured, sendTextMessage } from "@/lib/whatsapp/client";

/**
 * POST /api/cron/tick, called every 15 minutes by Supabase pg_cron + pg_net
 * with `Authorization: Bearer $CRON_SECRET` (AGENTS.md §4, §6).
 *
 * Safe to call any number of times: every step takes its work from a row with a
 * UNIQUE constraint, so a repeated or overlapping call finds the work already
 * claimed or done. Nothing here depends on the memory of an earlier call.
 *
 * Only counts are returned. The body of a diary, a summary, or a report never
 * leaves this function except into the database and the model call.
 */

/** Seconds. Generating a few reports takes several model calls, so the default is too short. */
export const maxDuration = 60;

/** Compares through a hash of each side, so the secret's length is not leaked and the compare is constant time. */
function matchesSecret(header: string | null, secret: string): boolean {
  const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();

  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // A missing secret is a setup problem, not a wrong password: say so, and never run unauthenticated.
    return NextResponse.json({ ok: false, message: "Penjadwal belum dikonfigurasi." }, { status: 503 });
  }

  if (!matchesSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const now = new Date();

    // First, so a period that just ended does not get one more premium report.
    const expiredPremiums = await expireEndedPremiums(admin, now);

    const reports = await runReports({ admin, now, generate: meteredReport });

    // Book files left behind by an account deleted outside the app (lib/books/sweep.ts).
    const orphanBookFiles = await sweepOrphanBookFiles(admin);

    // The 22:00 summary is only for people who linked WhatsApp, so without WhatsApp set up there is no one to run it for.
    const autoSummaries = isWhatsAppConfigured()
      ? await runAutoSummaries({
          admin,
          now,
          summarize: (input) =>
            summarizeUserDay({
              reader: admin,
              userId: input.userId,
              timeZone: input.timeZone,
              plan: input.plan,
              date: input.date,
            }),
          send: sendTextMessage,
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
        })
      : null;

    return NextResponse.json({ ok: true, expiredPremiums, reports, orphanBookFiles, autoSummaries });
  } catch (error) {
    console.error("tick failed", { kind: (error as Error).name });

    return NextResponse.json({ ok: false, message: "Tick gagal dijalankan." }, { status: 500 });
  }
}
