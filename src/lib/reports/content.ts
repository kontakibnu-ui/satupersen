import { z } from "zod";

/**
 * The finished report as the tick stores it in `reports.content`. The screen
 * parses every row with this, so a row that is still being written, was
 * skipped, or failed is never drawn as a report, and one odd row cannot take
 * the page down.
 */
export const reportContentSchema = z.object({
  status: z.literal("done"),
  variant: z.enum(["brief", "full"]),
  average_score: z.number(),
  previous_average_score: z.number().nullable(),
  delta_pct: z.number().nullable(),
  scored_days: z.number(),
  period_days: z.number(),
  trend: z.string(),
  focus: z.string(),
  patterns: z.array(z.string()),
  insights: z.array(z.string()),
});

export type ReportContent = z.infer<typeof reportContentSchema>;
