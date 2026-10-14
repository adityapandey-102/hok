"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { Profile } from "../../lib/domain";
import { Sidebar } from "./Sidebar";
import { BrandMark } from "./BrandMark";
import { Icon } from "../ui/Icon";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col xl:ml-65 print:ml-0">
        {/* Phones and tablets only: the menu button and the brand. On desktop the
            sidebar carries both, so an empty bar would just take space. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md xl:hidden print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-app p-2 text-text-secondary transition-colors hover:bg-app-bg"
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>

          {/* Brand context for mobile/tablet, where the sidebar is hidden. */}
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="font-serif text-[18px] text-text-primary">HOK</span>
          </div>
        </header>

        <main className="flex-1 bg-app-bg px-4 py-5 sm:px-6 lg:px-10 lg:py-9 print:bg-white print:p-0">
          {/* key on pathname so each route change replays the entrance animation */}
          <div key={pathname} className="animate-fade-in mx-auto w-full max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
