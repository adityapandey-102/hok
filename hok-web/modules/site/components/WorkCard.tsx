"use client";

import { useEffect, useRef } from "react";
import { reelUrl, type WorkItem } from "../content";
import { SiteIcon } from "./SiteIcon";

type MagnificPopup = { open: (options: Record<string, unknown>) => void };

/**
 * One reel: a sharp-cornered 9:16 poster with a small round play mark, the
 * category as small muted text, then the client name. No pill, no arrow.
 * Without a `video` the whole card opens the reel on Instagram in a new tab.
 * With a `video` (mp4) it plays muted and looping while on screen, and a click
 * opens a Magnific Popup lightbox that plays it with sound.
 */
export function WorkCard({ item }: { item: WorkItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { video } = item;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video]);

  function onClick(event: React.MouseEvent) {
    if (!video) return;
    const popup = (window as unknown as { jQuery?: { magnificPopup?: MagnificPopup } }).jQuery?.magnificPopup;
    if (!popup) return; // no lightbox: the link opens the mp4 itself
    event.preventDefault();
    popup.open({
      type: "inline",
      items: { src: `<div class="hok-lightbox"><video src="${video}" controls autoplay playsinline></video></div>` },
      mainClass: "mfp-fade",
      removalDelay: 200,
    });
  }

  return (
    <a
      href={video ?? reelUrl(item.reelId)}
      className="hok-work"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={`${item.client}, ${item.category}: watch the reel`}
    >
      <span className="hok-work__media">
        <img src={item.poster} alt="" loading="lazy" decoding="async" />
        {video && <video ref={videoRef} src={video} poster={item.poster} muted loop playsInline preload="none" />}
        <span className="hok-work__play" aria-hidden="true">
          <SiteIcon name="play" solid />
        </span>
      </span>
      <span className="hok-work__cat">{item.category}</span>
      <span className="hok-work__name">{item.client}</span>
    </a>
  );
}
