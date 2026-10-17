"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { Profile } from "../../lib/domain";
import { Sidebar } from "./Sidebar";
import { BrandLockup } from "./BrandMark";
import { Icon } from "../ui/Icon";
import { ThemeToggle } from "../ui/ThemeToggle";
import { InstallAppHint } from "../../modules/notifications/components/InstallAppHint";
import { NotificationBell } from "../../modules/notifications/components/NotificationBell";
import { ServiceWorkerRegistrar } from "../../modules/notifications/components/ServiceWorkerRegistrar";

/**
 * The staff app frame: the ink sidebar (a drawer below xl) and one sticky top
 * bar at every width -- menu + brand on phones and tablets, then the theme
 * switch and the bell (exactly one bell renders; each one polls).
 */
export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <ServiceWorkerRegistrar />
      <Sidebar profile={profile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-20 xl:ml-65 print:ml-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6 lg:border-transparent lg:bg-app-bg/60 lg:px-10 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 rounded-app p-2 text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary lg:hidden"
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <BrandLockup size={26} className="lg:hidden" />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-8 sm:px-6 lg:px-10 lg:pt-6 lg:pb-12 print:bg-white print:p-0">
          {/* key on pathname so each route change replays the entrance fade */}
          <div key={pathname} className="animate-fade-in mx-auto w-full max-w-[1400px]">
            <InstallAppHint />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
