import type { FeedbackView } from "@/lib/study/feedback";

/**
 * The AI's check of an explanation (DESIGN.md §6 "Umpan balik AI"): a label
 * that says the AI checked it against the material, one summary line, then only
 * the lists that have something in them. No red and no crosses; "Perlu dicek
 * lagi" uses the same ink dot as the rest. Plain text only (LEARN-6).
 */
export function FeedbackSheet({ feedback, headingId }: { feedback: FeedbackView; headingId: string }) {
  const lists: { title: string; items: string[] }[] = [
    { title: "Sudah tepat", items: feedback.correct },
    { title: "Yang terlewat", items: feedback.missing },
    { title: "Perlu dicek lagi", items: feedback.wrong },
    { title: "Tidak ada di bahanmu", items: feedback.notInMaterial },
  ];

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-border bg-surface p-5 md:p-6">
      <h2 id={headingId} className="font-heading text-lg font-bold text-text">
        Umpan balik penjelasan
      </h2>
      <p className="mt-1 text-sm text-text-muted">Diperiksa AI dari bahanmu</p>
      <p className="mt-4 text-base text-text">{feedback.summary}</p>

      {lists
        .filter((list) => list.items.length > 0)
        .map((list) => (
          <div key={list.title} className="mt-5">
            <h3 className="text-sm font-bold text-text">{list.title}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {list.items.map((item) => (
                <li key={item} className="flex gap-3 text-base text-text">
                  <span aria-hidden="true" className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
