export type PillTone = "purple" | "pink" | "green" | "amber" | "blue" | "gray" | "red" | "dark-red" | "gold";

const TONE_CLASSES: Record<PillTone, string> = {
  purple: "bg-primary-bg text-primary",
  pink: "bg-accent-bg text-text-secondary",
  green: "bg-success text-white",
  amber: "bg-warning-bg text-warning-text",
  blue: "bg-info-bg text-info",
  gray: "bg-gray-pill-bg text-text-secondary",
  red: "bg-error-bg text-error",
  "dark-red": "bg-danger-strong text-white",
  gold: "bg-gold-bg text-[#7d6230]",
};

export function StatusPill({ label, tone = "purple" }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-app-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
