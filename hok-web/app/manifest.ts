import type { MetadataRoute } from "next";

/**
 * The web app manifest (served at /manifest.webmanifest) that makes the staff
 * app installable as a PWA (FR: PWA, web push in M9). Installing opens the
 * staff app, not the portfolio. Icons are generated from public/hok-logo.png
 * by scripts/generate-pwa-icons.mjs. Colours are the design system's
 * (app/globals.css): the warm sand page background and the brand burgundy.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HOK · House of Khalak",
    short_name: "HOK",
    description: "House of Khalak agency workspace: clients, shoots, assets and team tasks.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5efe5",
    theme_color: "#7a1d34",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
