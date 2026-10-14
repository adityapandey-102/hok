import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The portfolio is the HOK HTML template ported as-is (README "Portfolio"),
    // a documented exception until its redesign: its images are plain <img>
    // from public/site, and its internal links are plain <a> on purpose -- a
    // full page load on every click, so the template's jQuery plugins start
    // fresh on each page.
    files: ["app/(site)/**/*.tsx", "app/global-not-found.tsx", "modules/site/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      // A root layout (SiteDocument) renders its own <head>; the rule is for the Pages Router.
      "@next/next/no-head-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The template's own files, copied unchanged.
    "public/site/**",
  ]),
]);

export default eslintConfig;
