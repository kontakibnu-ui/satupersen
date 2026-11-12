/**
 * The top of every signed in screen: an optional short line above, the screen
 * title in bold Plus Jakarta Sans, and an optional sentence under it.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-text-muted">{eyebrow}</p> : null}
        <h1 className="mt-1 font-heading text-title font-bold text-text">{title}</h1>
        {description ? <p className="mt-2 max-w-[52ch] text-base text-text-muted">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
