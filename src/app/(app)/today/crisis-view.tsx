import { HeartHandshake, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { crisisResponseFor, CRISIS_SERVICE, type CrisisLanguage } from "@/config/crisis";

/**
 * DESIGN.md §9: when the day carries crisis signs the screen changes entirely.
 * No score ring, no delta, no streak, nothing playful, and no animation. The
 * text is the fixed one written by a human in src/config/crisis.ts, never the
 * model's answer.
 *
 * The phone number is shown as text as well as a `tel:` link, because the
 * extension cannot be dialled automatically.
 */
export function CrisisView({
  language,
  keepWritingHref,
}: {
  language: CrisisLanguage;
  /**
   * The way back to the editor. Without it a false positive from the keyword
   * filter would hold someone on this screen until the next day.
   */
  keepWritingHref?: string;
}) {
  const isEnglish = language === "en";

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface-muted p-6">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-2xl bg-plum-soft text-plum"
      >
        <HeartHandshake size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-text">{crisisResponseFor(language)}</p>

      <a
        href={`tel:${CRISIS_SERVICE.phone}`}
        className={buttonVariants({ variant: "primary", className: "mt-6 min-h-14 w-full text-lg" })}
      >
        <Phone aria-hidden="true" size={20} strokeWidth={2} />
        {isEnglish ? `Call ${CRISIS_SERVICE.phone}` : `Telepon ${CRISIS_SERVICE.phone}`}
      </a>
      <p className="mt-2 text-center text-sm text-text-muted">
        {isEnglish
          ? `Then press extension ${CRISIS_SERVICE.phoneExtension}.`
          : `Lalu tekan ekstensi ${CRISIS_SERVICE.phoneExtension}.`}
      </p>

      <div className="mt-4 flex flex-col items-start">
        <a
          href={CRISIS_SERVICE.website}
          className={buttonVariants({ variant: "link" })}
          rel="noreferrer noopener"
          target="_blank"
        >
          {CRISIS_SERVICE.name}
        </a>

        {keepWritingHref ? (
          <a href={keepWritingHref} className={buttonVariants({ variant: "link" })}>
            {isEnglish ? "Keep writing" : "Lanjut menulis"}
          </a>
        ) : null}
      </div>
    </section>
  );
}
