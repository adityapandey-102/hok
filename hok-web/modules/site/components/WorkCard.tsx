"use client";

import { useRef } from "react";
import { reelUrl, type WorkItem } from "../content";

type MagnificPopup = { open: (options: Record<string, unknown>) => void };

/**
 * One reel: a rounded 9:16 poster that reveals with a clip. On hover (desktop)
 * the poster zooms and a gradient rises with the category and client name; the
 * cursor becomes a red disc with a play triangle (SiteMotion). Without hover the name sits below the card.
 * Without a `video` the whole card opens the reel on Instagram in a new tab.
 * With a `video` (mp4) it plays muted on hover, and a click opens a Magnific
 * Popup lightbox that plays it with sound.
 */
export function WorkCard({ item }: { item: WorkItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { video } = item;

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

  const play = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void videoRef.current?.play().catch(() => {});
  };
  const stop = () => videoRef.current?.pause();

  return (
    <a
      href={video ?? reelUrl(item.reelId)}
      className="hok-work"
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="play"
      onClick={onClick}
      onPointerEnter={video ? play : undefined}
      onPointerLeave={video ? stop : undefined}
      aria-label={`${item.client}, ${item.category}: watch the reel`}
    >
      <span className="hok-work__media" data-reveal="clip">
        <img src={item.poster} alt="" sizes="(min-width: 992px) 25vw, 70vw" loading="lazy" decoding="async" />
        {video && <video ref={videoRef} src={video} poster={item.poster} muted loop playsInline preload="none" />}
        <span className="hok-work__over" aria-hidden="true">
          <span className="hok-work__cat">{item.category}</span>
          <span className="hok-work__title">{item.client}</span>
        </span>
      </span>
      <span className="hok-work__below">
        <span className="hok-work__cat">{item.category}</span>
        <span className="hok-work__name">{item.client}</span>
      </span>
    </a>
  );
}
