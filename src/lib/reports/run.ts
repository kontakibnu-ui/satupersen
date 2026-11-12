import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedReport } from "@/lib/ai/openrouter";
import type { ReportPromptInput } from "@/lib/ai/prompts";
import { isValidTimeZone } from "@/lib/dates";
import { collectReportMaterial } from "@/lib/reports/data";
import {
  isReportWindowOpen,
  localMoment,
  periodFor,
  type ReportPeriod,
  type ReportType,
} from "@/lib/reports/period";

/**
 * The report part of the scheduled tick (REPORT-1, REPORT-2, REPORT-4).
 *
 * It is idempotent without any memory of its own. Every (user, type, period)
 * has one row in `reports`, protected by the UNIQUE constraint. A run claims a
 * report by inserting its row first, so two runs at the same moment can never
 * both generate it, and a run that finds a finished row does nothing.
 *
 * The clock and the model are passed in, so the same code is exercised with a
 * fixed time and a stand-in model in tests, and with the real ones by the route.
 */

/** `userId` is who the tokens of the report are recorded against (PRD.md §8). */
export type ReportGenerator = (input: ReportPromptInput, userId: string) => Promise<GeneratedReport>;

export type RunReportsOptions = {
  /** Service role client: the tick has no user session. */
  admin: SupabaseClient;
  now: Date;
  generate: ReportGenerator;
  /** Most reports written in one run, so one tick stays inside the request time limit. */
  maxGenerations?: number;
};

export type RunReportsSummary = {
  considered: number;
  generated: number;
  skipped: number;
  failed: number;
};

const DEFAULT_MAX_GENERATIONS = 6;
const PARALLEL_GENERATIONS = 3;
/** A failed report is tried again on later ticks, up to this many times in all. */
const MAX_ATTEMPTS = 3;
/** A claim with no result after this long is taken to be a crashed run and is reclaimed. */
const STALE_CLAIM_MS = 30 * 60 * 1000;
const PROFILE_PAGE = 500;
const LOOKUP_CHUNK = 150;

type Candidate = {
  userId: string;
  plan: "free" | "premium";
  type: ReportType;
  period: ReportPeriod;
};

type ExistingRow = {
  id: string;
  user_id: string;
  type: ReportType;
  period_start: string;
  created_at: string;
  content: { status?: string; attempts?: number } | null;
};

export async function runReports(options: RunReportsOptions): Promise<RunReportsSummary> {
  const { admin, now, generate } = options;
  const limit = options.maxGenerations ?? DEFAULT_MAX_GENERATIONS;
  const summary: RunReportsSummary = { considered: 0, generated: 0, skipped: 0, failed: 0 };

  const candidates = await findCandidates(admin, now);
  summary.considered = candidates.length;

  const existing = await loadExisting(admin, candidates);
  const work: { candidate: Candidate; reclaimId: string | null; attempts: number }[] = [];

  for (const candidate of candidates) {
    const row = existing.get(rowKey(candidate.userId, candidate.type, candidate.period.start));
    const status = row?.content?.status;
    const attempts = row?.content?.attempts ?? 0;

    if (!row) {
      work.push({ candidate, reclaimId: null, attempts: 0 });
    } else if (status === "failed" && attempts < MAX_ATTEMPTS) {
      work.push({ candidate, reclaimId: row.id, attempts });
    } else if (status === "pending" && now.getTime() - Date.parse(row.created_at) > STALE_CLAIM_MS) {
      work.push({ candidate, reclaimId: row.id, attempts });
    }
  }

  const claimed: typeof work = [];

  for (const item of work) {
    if (claimed.length >= limit) {
      break;
    }

    if (await claim(admin, item, now)) {
      claimed.push(item);
    }
  }

  for (let start = 0; start < claimed.length; start += PARALLEL_GENERATIONS) {
    const batch = claimed.slice(start, start + PARALLEL_GENERATIONS);
    const outcomes = await Promise.all(batch.map((item) => produce(admin, item, generate)));

    for (const outcome of outcomes) {
      summary[outcome] += 1;
    }
  }

  return summary;
}

const rowKey = (userId: string, type: string, periodStart: string) => `${userId}|${type}|${periodStart}`;

/** Users whose own clock says a report window is open right now. */
async function findCandidates(admin: SupabaseClient, now: Date): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  for (let from = 0; ; from += PROFILE_PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, timezone, plan")
      .not("consented_at", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PROFILE_PAGE - 1);

    if (error) {
      throw new Error("Profil tidak bisa dibaca");
    }

    for (const profile of data ?? []) {
      if (!isValidTimeZone(profile.timezone as string)) {
        continue;
      }

      const moment = localMoment(now, profile.timezone as string);
      const plan = profile.plan === "premium" ? "premium" : "free";

      // REPORT-4: everyone gets the short weekly report; the monthly one is premium.
      const types: ReportType[] = plan === "premium" ? ["weekly", "monthly"] : ["weekly"];

      for (const type of types) {
        if (isReportWindowOpen(type, moment)) {
          candidates.push({
            userId: profile.id as string,
            plan,
            type,
            period: periodFor(type, moment.day),
          });
        }
      }
    }

    if (!data || data.length < PROFILE_PAGE) {
      return candidates;
    }
  }
}

/** The report rows that already exist for the candidates, in as few reads as possible. */
async function loadExisting(
  admin: SupabaseClient,
  candidates: Candidate[],
): Promise<Map<string, ExistingRow>> {
  const rows = new Map<string, ExistingRow>();
  const groups = new Map<string, { type: ReportType; start: string; userIds: string[] }>();

  for (const candidate of candidates) {
    const key = `${candidate.type}|${candidate.period.start}`;
    const group = groups.get(key) ?? { type: candidate.type, start: candidate.period.start, userIds: [] };
    group.userIds.push(candidate.userId);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    for (let start = 0; start < group.userIds.length; start += LOOKUP_CHUNK) {
      const { data, error } = await admin
        .from("reports")
        .select("id, user_id, type, period_start, created_at, content")
        .eq("type", group.type)
        .eq("period_start", group.start)
        .in("user_id", group.userIds.slice(start, start + LOOKUP_CHUNK));

      if (error) {
        throw new Error("Laporan yang ada tidak bisa dibaca");
      }

      for (const row of (data ?? []) as ExistingRow[]) {
        rows.set(rowKey(row.user_id, row.type, row.period_start), row);
      }
    }
  }

  return rows;
}

/**
 * Takes the right to write this report. A new report is claimed by inserting its
 * row, which only one run can do. A failed or abandoned one is claimed by an
 * update that matches the status it was seen in, so only one run can win it.
 */
async function claim(
  admin: SupabaseClient,
  item: { candidate: Candidate; reclaimId: string | null; attempts: number },
  now: Date,
): Promise<boolean> {
  const { candidate } = item;

  if (item.reclaimId === null) {
    const { data, error } = await admin
      .from("reports")
      .upsert(
        {
          user_id: candidate.userId,
          type: candidate.type,
          period_start: candidate.period.start,
          period_end: candidate.period.end,
          content: { status: "pending", attempts: 0 },
          created_at: now.toISOString(),
        },
        { onConflict: "user_id,type,period_start", ignoreDuplicates: true },
      )
      .select("id");

    return !error && (data?.length ?? 0) > 0;
  }

  const { data, error } = await admin
    .from("reports")
    .update({ content: { status: "pending", attempts: item.attempts }, created_at: now.toISOString() })
    .eq("id", item.reclaimId)
    .in("content->>status", ["failed", "pending"])
    .select("id");

  return !error && (data?.length ?? 0) > 0;
}

/** Writes the claimed report: skipped when the period is too thin, failed when the model fails. */
async function produce(
  admin: SupabaseClient,
  item: { candidate: Candidate; attempts: number },
  generate: ReportGenerator,
): Promise<"generated" | "skipped" | "failed"> {
  const { candidate } = item;
  const where = {
    user_id: candidate.userId,
    type: candidate.type,
    period_start: candidate.period.start,
  };

  const save = async (content: Record<string, unknown>) => {
    const { error } = await admin.from("reports").update({ content }).match(where);

    if (error) {
      console.error("saving a report failed", { userId: candidate.userId, type: candidate.type });
    }
  };

  try {
    const variant = candidate.plan === "premium" ? "full" : "brief";
    const material = await collectReportMaterial(admin, {
      userId: candidate.userId,
      type: candidate.type,
      variant,
      period: candidate.period,
    });

    if (!material.enoughData) {
      await save({ status: "skipped", reason: "too_few_scored_days" });
      return "skipped";
    }

    const written = await generate(material.prompt, candidate.userId);

    await save({
      status: "done",
      variant: written.variant,
      ...material.numbers,
      trend: written.text.trend,
      focus: written.text.focus,
      patterns: written.variant === "full" ? written.text.patterns : [],
      // The model may only link two areas when both have enough days (REPORT-3);
      // the code enforces that even if the model ignores the instruction.
      insights: written.variant === "full" && material.crossAreaAllowed ? written.text.insights : [],
      model: written.model,
    });

    return "generated";
  } catch (error) {
    // Only the class of the failure is logged, never what the diary said (AGENTS.md §6).
    console.error("report generation failed", {
      userId: candidate.userId,
      type: candidate.type,
      kind: (error as Error).name,
    });
    await save({ status: "failed", attempts: item.attempts + 1 });
    return "failed";
  }
}
