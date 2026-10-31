import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "outline" | "ghost" | "danger" | "gold";

/**
 * Apple-style buttons (redesign 2026-10-23): flat fills, no lift, a press that
 * gives way under the finger. Ink for the main action (white in dark mode);
 * `outline` is the soft grey "secondary" fill; `danger` is solid red for a
 * confirmed destructive step; crimson ("gold", the old name) for the rare
 * brand highlight. Solid fills use `text-on-ink`, which flips with the theme.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:bg-ink-hover disabled:opacity-40",
  gold: "bg-primary text-white hover:bg-primary-dark disabled:opacity-50",
  outline: "bg-accent-bg text-text-primary hover:bg-accent-light/70 disabled:opacity-50",
  ghost: "text-text-secondary hover:bg-accent-bg hover:text-text-primary disabled:opacity-50",
  danger: "bg-error text-white hover:brightness-110 disabled:opacity-50",
};

const BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-app px-4 py-2 text-[15px] font-semibold transition-[background-color,transform,opacity] duration-150 outline-none select-none active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:active:scale-100 sm:text-sm";

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
