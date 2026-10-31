"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABELS, type Profile } from "../../lib/domain";
import { activeNavHref, visibleNavSections } from "./nav-config";
import { BrandLockup, BrandMark } from "./BrandMark";
import { Icon } from "../ui/Icon";
import { CommentsBadge } from "../../modules/client-comments/components/CommentsBadge";
import { authApi } from "../../modules/auth/api/authApi";
import { unsubscribeThisDevice } from "../../modules/notifications/pushDevice";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar({
  profile,
  open,
  onClose,
}: {
  profile: Profile;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = visibleNavSections(profile.role);
  const activeHref = activeNavHref(sections, pathname ?? "");

  async function handleSignOut() {
    // While still signed in: this device must stop getting this person's notifications.
    // Best effort -- signing out never waits on, or fails because of, push.
    await unsubscribeThisDevice().catch(() => undefined);
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  // Tablets in landscape (lg, below xl): a slim icon rail that is always there.
  // Phones and portrait tablets: the full sidebar as a drawer. Desktop: full.
  const rail = !open;
  const onlyFull = rail ? "lg:max-xl:hidden" : "";
  return (
    <>
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-45 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-65 flex-col gradient-sidebar shadow-app-lg border-r border-white/6 transition-[transform,width] duration-300 ease-out xl:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full lg:w-20 lg:translate-x-0 xl:w-65"
        }`}
      >
        {/* Brand: the House of Khalak logo, white lettering on ink. */}
        <div className={`px-5 pt-6 pb-6 ${rail ? "lg:max-xl:flex lg:max-xl:justify-center lg:max-xl:px-2" : ""}`}>
          <BrandLockup size={34} onDark className={`animate-fade-in ${onlyFull}`} />
          <BrandMark height={14} className={`hidden ${rail ? "lg:max-xl:block" : ""}`} />
        </div>

        <nav aria-label="Main" className={`flex-1 overflow-y-auto px-3 pb-4 ${rail ? "lg:max-xl:px-2" : ""}`}>
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className={`px-3 pb-1.5 text-[11px] font-medium text-white/35 ${onlyFull}`}>
                {section.label}
              </div>
              {section.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    className={`group relative mb-0.5 flex items-center gap-3 rounded-app px-3 py-2 text-[13.5px] transition-colors duration-150 ${
                      rail ? "lg:max-xl:justify-center lg:max-xl:py-2.5" : ""
                    } ${isActive ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/6 hover:text-white"}`}
                  >
                    {/* The current page's icon fills in crimson, like a tinted selected symbol on macOS. */}
                    <Icon
                      emoji={item.icon}
                      size={18}
                      filled={isActive}
                      className={isActive ? "text-brand-on-dark" : "text-white/50 group-hover:text-white/85"}
                    />
                    <span className={rail ? "lg:max-xl:sr-only" : ""}>{item.label}</span>
                    {item.badge === "comments" && (
                      <CommentsBadge className={`ml-auto ${rail ? "lg:max-xl:absolute lg:max-xl:top-0.5 lg:max-xl:right-0.5 lg:max-xl:ml-0" : ""}`} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={`border-t border-white/8 p-4 ${rail ? "lg:max-xl:px-2" : ""}`}>
          <div className={`flex items-center gap-2.5 ${rail ? "lg:max-xl:justify-center" : ""}`} title={profile.fullName}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white ring-1 ring-white/15">
              {initials(profile.fullName)}
            </div>
            <div className={`min-w-0 flex-1 ${onlyFull}`}>
              <div className="truncate text-sm font-medium text-white">{profile.fullName}</div>
              <div className="truncate text-[11px] text-white/45">{ROLE_LABELS[profile.role]}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full rounded-app border border-white/12 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/25 hover:text-white"
            title="Sign out"
          >
            <span className={onlyFull}>Sign out</span>
            <span className={`hidden justify-center ${rail ? "lg:max-xl:flex" : ""}`}>
              <Icon name="log-out" size={14} />
            </span>
            <span className={`sr-only ${rail ? "" : "hidden"}`}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
