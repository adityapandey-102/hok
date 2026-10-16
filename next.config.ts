import type { NextConfig } from "next";
import os from "os";

/**
 * This machine's own LAN IPv4 addresses (e.g. 192.168.1.4). Used to allowlist
 * cross-origin dev requests below. Auto-detected -- not hardcoded -- so opening
 * the app from a phone keeps working no matter what address DHCP hands out.
 */
function lanIPv4s(): string[] {
  const addrs: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface ?? []) {
      // Node <18 reports family as "IPv4"; >=18 as 4. Accept both.
      const isV4 = net.family === "IPv4" || (net.family as unknown as number) === 4;
      if (isV4 && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

const nextConfig: NextConfig = {
  // Build/dev output folder. Next allows ONE dev server per folder, so agents
  // working in parallel each use their own: `NEXT_DIST_DIR=.next-web npx next
  // dev -p 3401` (docs/AGENT-COORDINATION.md). Default stays `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // DEV-ONLY: allow the dev server's /_next/* resources (JS chunks + the HMR
  // WebSocket) to be requested from this machine's LAN address, so the app can
  // be opened from another device (e.g. a phone) at http://<lan-ip>:3400.
  // Next 16 otherwise blocks these as cross-origin, which breaks HMR *and*
  // hydration (the page loads but isn't interactive -- forms fall back to a
  // plain GET, so login silently does nothing). Auto-detected so it never goes
  // stale when the IP changes. No effect on the production build.
  allowedDevOrigins: ["localhost", "127.0.0.1", ...lanIPv4s()],
  // The service worker (public/sw.js, M9 web push) must never be served from a
  // cache, or a fixed version would take days to reach installed apps.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    // app/global-not-found.tsx: one 404 page for unmatched URLs. Needed
    // because the app has two root layouts ((site) and (main)), so there is
    // no single root layout a plain not-found.tsx could render inside.
    globalNotFound: true,
  },
};

export default nextConfig;
