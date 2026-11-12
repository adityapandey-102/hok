/**
 * A HOK button: a square, magnetic button whose fill slides up on hover and
 * that has a small round marker before its label (not an arrow). Every button
 * on the site is this one component. `contact` makes it open the contact modal
 * (SiteMotion) and still link to /contact without JavaScript.
 */
export function Btn({
  href,
  variant = "primary",
  contact = false,
  reveal = false,
  type,
  className = "",
  children,
  ...rest
}: {
  href?: string;
  variant?: "primary" | "ghost";
  contact?: boolean;
  reveal?: boolean;
  type?: "button" | "submit";
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "type" | "href">) {
  const cls = `hok-btn hok-btn--${variant} ${className}`.trim();
  const inner = (
    <>
      <span className="hok-btn__dot" aria-hidden="true" />
      {children}
    </>
  );
  const extra = { "data-magnetic": "", ...(contact ? { "data-contact": "" } : {}), ...(reveal ? { "data-reveal": "up" } : {}) };
  if (href) {
    return (
      <a href={href} className={cls} {...extra} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} {...extra}>
      {inner}
    </button>
  );
}
