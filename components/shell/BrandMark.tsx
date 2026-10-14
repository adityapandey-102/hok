"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The HOK (House of Khalak) brand mark. Renders the firm's logo from
 * `public/hok-logo.png` -- a red wordmark on white, so it sits on a white tile
 * (it must read on the dark sidebar too) and is zoomed slightly past the
 * file's own white margins. If the file is missing it degrades to a burgundy
 * "H" monogram so the UI always looks finished -- needleye's BrandMark
 * behaviour, unchanged.
 */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const box = { width: size, height: size };

  // The <img> is server-rendered, so a 404 can fire its error event *before*
  // React hydrates and attaches onError. Re-check once mounted: a broken image
  // is `complete` with zero natural width.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div
        className={`gradient-primary flex items-center justify-center rounded-app font-serif font-bold text-gold-light shadow-primary ${className}`}
        style={{ ...box, fontSize: size * 0.5 }}
        aria-label="HOK"
      >
        H
      </div>
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-app bg-white ${className}`} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand asset from /public; a plain <img> is needed for the onError monogram fallback */}
      <img
        ref={imgRef}
        src="/hok-logo.png"
        alt="HOK"
        onError={() => setFailed(true)}
        className="h-full w-full scale-[1.35] object-contain"
      />
    </div>
  );
}
