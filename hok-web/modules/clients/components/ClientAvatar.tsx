/** A client's logo, or their initials on a tinted tile when there is none. */
export function ClientAvatar({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14 rounded-app-lg text-base sm:h-16 sm:w-16 sm:text-lg" : "h-10 w-10 rounded-app text-xs";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an owner-supplied external URL, shown small
      <img src={logoUrl} alt="" className={`${box} shrink-0 bg-card object-cover ring-1 ring-border ring-inset`} />
    );
  }
  return (
    <span aria-hidden className={`${box} flex shrink-0 items-center justify-center bg-accent-bg font-semibold text-text-secondary ring-1 ring-border ring-inset`}>
      {initials || "?"}
    </span>
  );
}
