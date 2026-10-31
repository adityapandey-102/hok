import Link from "next/link";
import { BrandLogo, BrandMark } from "../../../components/shell/BrandMark";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";

/**
 * Sign-in, first-time setup and password pages. Desktop: the ink panel (the
 * sidebar's colour) carries the logo, one line on what this is, and the red
 * HOK letters drawn large and cropped by the panel's edge over a slow crimson
 * glow -- they rise in once as the page opens. Phones: the logo above the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-app-bg">
      <aside className="relative hidden w-[46%] max-w-160 flex-col justify-between overflow-hidden gradient-sidebar px-14 py-12 text-white lg:flex">
        <div aria-hidden className="ambient-glow pointer-events-none absolute -right-40 -bottom-40 h-[560px] w-[560px] rounded-full" />

        <BrandLogo height={44} tone="on-dark" priority className="relative z-10" />

        <div className="relative z-10 max-w-sm">
          <p className="font-serif text-[34px] leading-[1.1] text-white">Clients, shoots and the team, in one place.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">Plan every campaign stage, share progress with clients and keep the team on time.</p>
        </div>

        <span aria-hidden />

        <BrandMark height={190} className="animate-rise pointer-events-none absolute -bottom-10 left-12 w-auto max-w-none opacity-95" />
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="animate-rise w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo height={52} priority />
          </div>
          <div className="rounded-app-lg border border-border bg-card p-7 shadow-app-lg">{children}</div>
          <p className="mt-6 text-center text-[12px] text-text-muted">
            <Link href="/" className="hover:text-primary">
              Back to the website
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
