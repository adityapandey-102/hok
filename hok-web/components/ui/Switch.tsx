/**
 * An on/off switch (a button with role="switch"), the way iOS shows a setting.
 * The label sits to its right and is part of the click target. Ink when on,
 * both colours flip with the theme.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** One muted line under the label. */
  hint?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-ink" : "bg-border"
        }`}
      >
        <span aria-hidden className={`inline-block h-5 w-5 rounded-full shadow-app transition-transform ${checked ? "translate-x-[22px] bg-on-ink" : "translate-x-0.5 bg-card"}`} />
      </button>
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${disabled ? "text-text-muted" : "text-text-primary"}`}>{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </div>
  );
}
