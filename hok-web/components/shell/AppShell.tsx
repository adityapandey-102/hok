"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { Profile } from "../../lib/domain";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { BrandLockup } from "./BrandMark";
import { ThemeToggle } from "../ui/ThemeToggle";
import { GlobalSearch } from "./GlobalSearch";
import { GuideMe } from "./GuideMe";
import { InstallAppHint } from "../../modules/notifications/components/InstallAppHint";
import { NotificationBell } from "../../modules/notifications/components/NotificationBell";
import { ServiceWorkerRegistrar } from "../../modules/notifications/components/ServiceWorkerRegistrar";

/**
 * The staff app frame: the ink sidebar (an icon rail on landscape tablets, full
 * from xl), a translucent top bar at every width (brand on phones, search,
 * Guide, theme, the one bell), and below lg the iOS-style tab bar, whose
 * "More" opens the full menu as a drawer.
 */
export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <ServiceWorkerRegistrar />
      <Sidebar profile={profile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-20 xl:ml-65 print:ml-0">
        <header className="material sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border-light/80 px-4 sm:px-6 lg:px-10 print:hidden">
          <BrandLockup size={26} className="lg:hidden" />

          <div className="flex min-w-0 flex-1 justify-end md:justify-start md:pl-4 lg:pl-0">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1">
            <GuideMe role={profile.role} />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="pb-tabbar flex-1 px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8 lg:pb-14 print:bg-white print:p-0">
          {/* key on pathname so each route change replays the entrance fade */}
          <div key={pathname} className="animate-fade-in mx-auto w-full max-w-[1400px]">
            <InstallAppHint />
            {children}
          </div>
        </main>
      </div>
      <TabBar role={profile.role} onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
