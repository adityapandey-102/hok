"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Starts the template's main.js once React has hydrated the page.
 *
 * jQuery and the plugins load earlier, in order, as `beforeInteractive`
 * scripts (SiteDocument). main.js is different: it changes the DOM (Swiper
 * clones slides, Nice Select inserts markup, AOS adds classes), so it must run
 * only after hydration, or React would find a DOM it didn't render.
 */
export function SiteScripts() {
  useEffect(() => {
    // The template's `javascript:void(0)` links became `href="#" role="button"`
    // (React blocks javascript: URLs). Stop them jumping to the top of the page.
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest?.('a[role="button"][href="#"]')) event.preventDefault();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <Script
      src="/site/assets/js/main.js"
      strategy="afterInteractive"
      onLoad={() => {
        // main.js hides the preloader on window "load". If the page finished
        // loading before main.js ran, replay that event so the preloader lifts.
        const $ = (window as unknown as { jQuery?: (el: unknown) => { trigger: (e: string) => void } }).jQuery;
        if ($ && document.readyState === "complete") $(window).trigger("load");
      }}
    />
  );
}
