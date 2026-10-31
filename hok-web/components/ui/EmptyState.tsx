import { Icon, type IconName } from "./Icon";

/**
 * An empty list or panel: an icon on two soft rings with a crimson spot (the
 * one thing to notice), a short title, one line on what to do, and an
 * optional action. `compact` for inside a card.
 */
export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
  compact = false,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: IconName;
  compact?: boolean;
  className?: string;
}) {
  const box = compact ? "h-12 w-12" : "h-16 w-16";
  return (
    <div className={`animate-fade-in flex flex-col items-center text-center ${compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12"} ${className}`}>
      <div className={`relative flex items-center justify-center rounded-full bg-accent-bg ring-8 ring-accent-bg/50 ${box}`} aria-hidden>
        <Icon name={icon} size={compact ? 20 : 26} strokeWidth={1.6} className="text-text-muted" />
        <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
      </div>
      <div className={compact ? "mt-1" : "mt-2"}>
        <p className={`font-medium text-text-primary ${compact ? "text-sm" : "text-[15px]"}`}>{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
