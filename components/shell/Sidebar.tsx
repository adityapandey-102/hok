"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABELS, type Profile } from "../../lib/domain";
import { visibleNavSections } from "./nav-config";
import { BrandMark } from "./BrandMark";
import { Icon } from "../ui/Icon";
import { authApi } from "../../modules/auth/api/authApi";

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
  // Highlight only the MOST specific matching link: on /app/clients/new that's
  // "New client", not also "Dashboard" (/app is a prefix of it).
  const activeHref = sections
    .flatMap((sec) => sec.items.map((i) => i.href))
    .filter((href) => pathname === href || !!pathname?.startsWith(href + "/"))
    .sort((x, y) => y.length - x.length)[0];

  async function handleSignOut() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-65 flex-col gradient-sidebar shadow-app-lg transition-transform duration-300 ease-out xl:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <BrandMark size={38} />
            <div className="flex flex-col">
              <span className="font-serif text-[21px] leading-none text-white">HOK</span>
              <span className="mt-1 font-serif text-[12px] leading-none text-gold-light/85 italic">House of Khalak</span>
            </div>
          </div>
          <div className="stitch-rule mt-5 opacity-60" aria-hidden />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="px-3 pb-1.5 text-[11px] font-medium text-white/35">
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
                    className={`group relative mb-0.5 flex items-center gap-3 rounded-app px-3 py-2 text-[13.5px] transition-colors duration-150 ${
                      isActive ? "bg-white/7 font-medium text-white" : "text-white/60 hover:bg-white/4 hover:text-white"
                    }`}
                  >
                    {/* The signature: a vertical tacking stitch in gold beside the current page. */}
                    {isActive && <span className="stitch-rule-v absolute top-1.5 bottom-1.5 left-0" aria-hidden />}
                    <Icon
                      emoji={item.icon}
                      size={16}
                      strokeWidth={1.5}
                      className={isActive ? "text-gold-light" : "text-white/45 group-hover:text-white/80"}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-gold text-[12px] font-semibold text-primary-dark ring-2 ring-gold-light/30">
              {initials(profile.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{profile.fullName}</div>
              <div className="truncate text-[11px] text-white/45">{ROLE_LABELS[profile.role]}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full rounded-app border border-white/12 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/25 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
