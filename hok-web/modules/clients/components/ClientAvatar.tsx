"use client";

import { useState } from "react";
import { logoImageSrc } from "../../../lib/domain/utils/links";

/** A client's logo, or their initials on a tinted tile when there is none or the logo URL doesn't load. */
export function ClientAvatar({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "md" | "lg" }) {
  // Remember which URL failed, so a corrected logo URL is tried again.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const box = size === "lg" ? "h-14 w-14 rounded-app-lg text-base sm:h-16 sm:w-16 sm:text-lg" : "h-10 w-10 rounded-app text-xs";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (logoUrl && brokenUrl !== logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an owner-supplied external URL, shown small
      <img src={logoImageSrc(logoUrl)} alt="" onError={() => setBrokenUrl(logoUrl)} referrerPolicy="no-referrer" className={`${box} shrink-0 bg-card object-cover ring-1 ring-border ring-inset`} />
    );
  }
  return (
    <span aria-hidden className={`${box} flex shrink-0 items-center justify-center bg-accent-bg font-semibold text-text-secondary ring-1 ring-border ring-inset`}>
      {initials || "?"}
    </span>
  );
}
