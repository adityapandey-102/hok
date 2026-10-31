/**
 * Loading indicator: a crimson arc turning on a hairline track, with an
 * accessible status. For layout-shaped loading prefer `.skeleton` blocks.
 */
export function Loader({ label = "Loading", size = 28, className = "" }: { label?: string; size?: number; className?: string }) {
  return (
    <span role="status" className={`inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 40 40" width={size} height={size} className="animate-spin [animation-duration:0.9s]" aria-hidden>
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
        <path d="M20 4a16 16 0 0 1 16 16" fill="none" stroke="var(--color-primary)" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
