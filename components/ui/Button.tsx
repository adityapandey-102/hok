import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "outline" | "ghost" | "danger" | "gold";

/** Brand buttons: burgundy for the main action, gold for highlights, hairline for the rest. */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "gradient-primary text-white shadow-primary hover:-translate-y-px hover:brightness-110 hover:shadow-app-lg disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none",
  gold: "gradient-gold text-primary-dark shadow-gold hover:-translate-y-px hover:brightness-105 disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none",
  outline: "border border-border bg-card text-text-primary hover:border-primary/40 hover:bg-primary-bg",
  ghost: "text-text-secondary hover:bg-primary-bg hover:text-text-primary",
  danger: "bg-error text-white shadow-app-md hover:brightness-105 disabled:opacity-60 disabled:shadow-none",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-app px-4 py-2.5 text-sm font-semibold transition-all duration-200 outline-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-1 focus-visible:ring-offset-app-bg disabled:cursor-not-allowed disabled:active:scale-100";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", disabled, children, ...props },
  ref,
) {
  return (
    <button ref={ref} disabled={disabled} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
});

/**
 * A link that looks like a button -- for navigation. One element, so it's one
 * stop for the keyboard and one control for screen readers (a <button> inside
 * a link is invalid HTML and announced twice). Phone, WhatsApp and other
 * off-site addresses get a plain <a>; the app's own pages go through next/link.
 */
export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant }) {
  const classes = `${BASE} ${VARIANT_CLASSES[variant]} ${className}`;
  if (/^(https?:|tel:|mailto:)/.test(href)) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
