import { splitLinks } from "../../lib/domain/utils/links";

/**
 * Typed text with its http(s) addresses clickable (an event's "Location or
 * link"). Links open in a new tab and never send the page URL (the portal URL
 * is the client's credential), hence `noopener noreferrer`.
 */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="font-medium break-all text-primary underline-offset-2 hover:underline">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
