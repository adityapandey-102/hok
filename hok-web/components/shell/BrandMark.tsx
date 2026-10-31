import Image from "next/image";

// Transparent cuts of public/hok-logo.png (public/brand/): the full logo with
// ink lettering, the same with white lettering, and the red HOK mark alone.
const LOGO = { w: 1600, h: 418 };
const MARK = { w: 1200, h: 215 };

/**
 * The House of Khalak logo. `tone="auto"` follows the theme (ink lettering on
 * light, white on dark); `tone="on-dark"` is for the always-dark ink surfaces
 * (the sidebar, the sign-in panel).
 */
export function BrandLogo({
  height = 40,
  tone = "auto",
  priority = false,
  className = "",
}: {
  height?: number;
  tone?: "auto" | "on-dark";
  priority?: boolean;
  className?: string;
}) {
  const width = Math.round((height * LOGO.w) / LOGO.h);
  const alt = "HOK, House of Khalak";
  if (tone === "on-dark") {
    return <Image src="/brand/hok-logo-dark.png" alt={alt} width={width} height={height} priority={priority} className={className} />;
  }
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <Image src="/brand/hok-logo-light.png" alt={alt} width={width} height={height} priority={priority} className="dark:hidden" />
      <Image src="/brand/hok-logo-dark.png" alt={alt} width={width} height={height} priority={priority} className="hidden dark:block" />
    </span>
  );
}

/** The red HOK letters alone: compact headers and large brand graphics. Reads on any background. */
export function BrandMark({ height = 24, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * MARK.w) / MARK.h);
  return <Image src="/brand/hok-logo-mark.png" alt="HOK" width={width} height={height} className={`shrink-0 ${className}`} />;
}

/** The logo sized by its overall height (`size`), for headers and the sidebar. */
export function BrandLockup({ size = 34, onDark = false, className = "" }: { size?: number; onDark?: boolean; className?: string }) {
  return <BrandLogo height={Math.round(size * 1.15)} tone={onDark ? "on-dark" : "auto"} priority className={className} />;
}
