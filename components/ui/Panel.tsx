import Link from "next/link";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";

/**
 * A panel with a header and an optional footer link: icon, title and a one-line subtitle, the body, and a
 * footer link to the full, paged list ("View all 12 …") -- the dashboard only
 * ever shows a preview.
 */
export function Panel({
  icon,
  title,
  subtitle,
  action,
  footer,
  className = "",
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card regionLabel={title} className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
          <Icon name={icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[15.5px] leading-snug text-text-primary">{title}</h3>
          {subtitle && <p className="truncate text-xs text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
      {footer && (
        <Link
          href={footer.href}
          className="group flex items-center justify-between gap-2 border-t border-border-light px-5 py-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary"
        >
          {footer.label}
          <Icon name="chevron-right" size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </Card>
  );
}
