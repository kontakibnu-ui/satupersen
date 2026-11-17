import { explanationFeedbackSchema, type ExplanationFeedback } from "@/lib/ai/schemas";

/**
 * The explanation feedback as the screen shows it (LEARN-2). The stored JSON is
 * validated again on the way out, so a row that does not fit is shown as no
 * feedback rather than half drawn.
 */
export type FeedbackView = {
  summary: string;
  correct: string[];
  missing: string[];
  wrong: string[];
  notInMaterial: string[];
};

export function fromExplanationFeedback(feedback: ExplanationFeedback): FeedbackView {
  return {
    summary: feedback.summary,
    correct: feedback.correct,
    missing: feedback.missing,
    wrong: feedback.wrong,
    notInMaterial: feedback.not_in_material,
  };
}

export function toFeedbackView(stored: unknown): FeedbackView | null {
  const parsed = explanationFeedbackSchema.safeParse(stored);

  return parsed.success ? fromExplanationFeedback(parsed.data) : null;
}
