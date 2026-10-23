import { MARK_A, MARK_ARC, MARK_TILE, WORDMARK_PATH, WORDMARK_WIDTH } from "@/components/brand-paths";

function Mark({ mono }: { mono: boolean }) {
  return (
    <>
      <path d={MARK_TILE} fill={mono ? "currentColor" : "var(--brand-navy)"} />
      <path d={MARK_A} fill="none" stroke={mono ? "var(--card)" : "#ffffff"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={MARK_ARC} fill="none" stroke={mono ? "var(--card)" : "var(--brand-teal-light)"} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** The Atlas mark alone. */
export function AtlasMark({ className = "size-6", mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <Mark mono={mono} />
    </svg>
  );
}

/** Mark and wordmark. `mono` draws everything in the current text colour for single-colour use. */
export function Brand({ mono = false, className = "h-6" }: { mono?: boolean; className?: string }) {
  return (
    <svg viewBox={`0 0 ${WORDMARK_WIDTH} 24`} role="img" aria-label="Atlas" className={`w-auto self-start ${className}`}>
      <Mark mono={mono} />
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}
