import Link from "next/link";
import type { IconName } from "./Icon";

/**
 * A section, the way Apple apps group content (redesign 2026-10-23): a plain
 * heading ABOVE a white group -- title, an optional one-line note, and on the
 * right an optional action plus the "See all" link to the full, paged list
 * (the dashboard only ever shows a preview). No icon badges or footer bars;
 * the content is the visual.
 *
 * \`icon\` is still accepted from older call sites but no longer drawn.
 */
export function Panel({
  title,
  subtitle,
  action,
  footer,
  className = "",
  children,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={`flex min-w-0 flex-col ${className}`}>
      <div className="flex items-end justify-between gap-3 px-1 pb-2">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug font-semibold tracking-[-0.01em] text-text-primary">{title}</h3>
          {subtitle && <p className="truncate text-[13px] text-text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {footer && (
            <Link href={footer.href} className="rounded-app-sm text-[14px] font-medium text-primary hover:underline focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
              {footer.label}
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-app-lg bg-card shadow-app print:border print:border-neutral-300">{children}</div>
    </section>
  );
}
