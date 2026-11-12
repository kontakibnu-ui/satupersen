import { NextResponse } from "next/server";
import { todayKey } from "@/lib/dates";
import { fetchAllRows } from "@/lib/paging";
import { getActionContext } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/account/export: everything the signed in user has stored, as one JSON
 * file (PRD.md §7: export is for every plan, with no condition).
 *
 * Several tables are server only, so the read uses the service role; every query
 * filters by the user id taken from the session, never from the request, so one
 * user can only ever download their own data. Derived data is left out on
 * purpose (the search index of Phase 7 will not be here), and so are values the
 * user has no use for: the payment provider's reference and the link codes.
 */

const TABLES = [
  { key: "entries", table: "entries", columns: "date, content, mood, energy, updated_at", order: "date" },
  { key: "habits", table: "habits", columns: "id, name, identity, archived_at, created_at", order: "created_at" },
  { key: "habit_logs", table: "habit_logs", columns: "habit_id, date", order: "date" },
  { key: "expenses", table: "expenses", columns: "date, type, amount, category, note, created_at", order: "date" },
  { key: "budgets", table: "budgets", columns: "month, amount", order: "month" },
  {
    key: "daily_summaries",
    table: "daily_summaries",
    columns:
      "date, status, summary, strengths, improvements, tomorrow_tip, ai_dimension_score, score, score_dimensions, delta_pct, score_reason, risk_flag, regen_count",
    order: "date",
  },
  { key: "reports", table: "reports", columns: "type, period_start, period_end, content, created_at", order: "period_start" },
  { key: "whatsapp_messages", table: "wa_messages", columns: "direction, kind, body, created_at", order: "created_at" },
  {
    key: "ai_usage",
    table: "ai_usage",
    columns: "feature, model, prompt_tokens, completion_tokens, created_at",
    order: "created_at",
  },
] as const;

export async function GET() {
  const context = await getActionContext();

  if (!context) {
    return NextResponse.json({ message: "Sesi kamu sudah berakhir. Masuk lagi dulu." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { userId } = context;

  try {
    const [profile, whatsapp, subscriptions, ...tables] = await Promise.all([
      admin
        .from("profiles")
        .select("name, timezone, plan, premium_until, consented_at, created_at")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            throw new Error("Profil tidak bisa dibaca");
          }

          return data;
        }),
      admin
        .from("whatsapp_links")
        .select("phone, verified_at, opted_in, reminder_time")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            throw new Error("Data WhatsApp tidak bisa dibaca");
          }

          return data;
        }),
      admin
        .from("subscriptions")
        .select("provider, plan, status, current_period_end")
        .eq("user_id", userId)
        .then(({ data, error }) => {
          if (error) {
            throw new Error("Langganan tidak bisa dibaca");
          }

          return data ?? [];
        }),
      ...TABLES.map(({ table, columns, order }) =>
        fetchAllRows<Record<string, unknown>>(
          (from, to) =>
            admin
              .from(table)
              .select(columns)
              .eq("user_id", userId)
              .order(order, { ascending: true })
              .order(table === "habit_logs" ? "habit_id" : order, { ascending: true })
              .range(from, to) as never,
          `Data ${table} tidak bisa dibaca`,
        ),
      ),
    ]);

    const body = {
      exported_at: new Date().toISOString(),
      note: "Semua data Satu Persen milikmu. Analisa dan skor dibuat oleh AI dari tulisanmu.",
      profile,
      whatsapp,
      subscriptions,
      ...Object.fromEntries(TABLES.map((entry, index) => [entry.key, tables[index]])),
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="satupersen-data-${todayKey(context.timeZone)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("export failed", { userId, kind: (error as Error).name });

    return NextResponse.json({ message: "Data belum bisa diekspor. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
