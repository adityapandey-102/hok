"use client";

import { useEffect, useRef, useState } from "react";
import { calendarFeedApi, googleSubscribeUrl, isLocalAddress, type FeedLink } from "../calendarApi";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Modal } from "../../../components/ui/Modal";
import { OneTimeLink } from "../../../components/ui/OneTimeLink";
import { useToast } from "../../../components/ui/Toast";

/**
 * "Add to Google Calendar" (FR-CAL-08): one secret subscribe link per
 * person. The address is shown once, right after it's made, and lives only
 * in this dialog's state (the API stores just its hash).
 */
export function CalendarSubscribe({ timeZone }: { timeZone: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon name="share" size={16} /> Add to Google Calendar
      </Button>
      {open && <SubscribeDialog timeZone={timeZone} onClose={() => setOpen(false)} />}
    </>
  );
}

type Loaded = { link: FeedLink } | { error: string };
/**
 * Steps that need a second click, asked INSIDE the dialog: a confirm dialog
 * stacked on this one would share its Escape key and close both.
 */
type Pending = "replace" | "off" | "close" | null;

function SubscribeDialog({ timeZone, onClose }: { timeZone: string; onClose: () => void }) {
  const { showToast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    let cancelled = false;
    calendarFeedApi
      .get()
      .then((d) => !cancelled && setLoaded({ link: d.link }))
      .catch((err) => !cancelled && setLoaded({ error: err instanceof Error ? err.message : "Could not load your calendar link" }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const link = loaded && "link" in loaded ? loaded.link : null;
  const since = link
    ? new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(link.createdAt))
    : null;

  /** Escape, the backdrop and X all come here: never lose a link that hasn't been copied, or one still being made. */
  function requestClose() {
    if (busy) return;
    if (url && !copied && pending !== "close") return setPending("close");
    onClose();
  }

  async function make() {
    // An existing link stops working the moment a new one is made: ask first.
    if (link && pending !== "replace") return setPending("replace");
    setPending(null);
    setBusy(true);
    try {
      const res = await calendarFeedApi.create();
      setLoaded({ link: res.link });
      setUrl(res.url);
      setCopied(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not make the link", "error");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (pending !== "off") return setPending("off");
    setPending(null);
    setBusy(true);
    try {
      await calendarFeedApi.revoke();
      setLoaded({ link: null });
      setUrl(null);
      showToast("Calendar link turned off.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not turn the link off", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={requestClose} labelledBy="subscribe-title" initialFocusRef={closeRef} panelClassName="sm:max-w-xl">
      <div className="flex items-center gap-3 border-b border-border-light px-5 py-4">
        <Icon name="calendar" size={18} className="text-primary" />
        <h2 id="subscribe-title" className="font-serif text-lg text-text-primary">
          Add to Google Calendar
        </h2>
        <button ref={closeRef} type="button" onClick={requestClose} aria-label="Close" className="ml-auto rounded-app p-1.5 text-text-muted hover:bg-accent-bg">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 text-sm text-text-secondary">
        <p>
          See your HOK calendar inside Google Calendar (or Apple Calendar, Outlook). It shows the last 30 days and the next 6 months, and updates on its own. Google
          checks for changes on its own schedule, usually within a day, so use HOK for anything urgent.
        </p>

        {!loaded ? (
          <div className="skeleton h-12 rounded-app-lg" aria-busy="true" aria-label="Loading your calendar link" />
        ) : "error" in loaded ? (
          <div className="flex items-center justify-between gap-3 text-error">
            <span>{loaded.error}</span>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : (
          <p className="rounded-app-lg bg-accent-bg p-3 ring-1 ring-border-light ring-inset" data-testid="feed-status">
            {link ? `Your link is on (made ${since}).` : "You have no calendar link yet."}
          </p>
        )}

        {url && (
          <OneTimeLink
            url={url}
            testId="feed-url"
            note="Keep it private: anyone with this link can see your calendar. It is shown only this once."
            copyLabel="Copy link"
            onCopied={() => setCopied(true)}
            actions={
              <a
                href={googleSubscribeUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCopied(true)}
                className="inline-flex items-center justify-center gap-2 rounded-app bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink hover:bg-ink-hover"
              >
                <Icon name="external-link" size={16} /> Open Google Calendar
              </a>
            }
          >
            {isLocalAddress(url) && (
              <p className="mt-2 text-xs text-warning-text">This copy of HOK isn&apos;t on the internet, so Google can&apos;t reach it yet. The link works once HOK is online.</p>
            )}
            <p className="mt-3 text-xs text-text-muted">Other apps: copy the link, then use “Subscribe to calendar” / “Add calendar from URL”.</p>
          </OneTimeLink>
        )}

        {pending && (
          <div role="alert" className="rounded-app-lg border border-warning/40 bg-warning-bg p-3 text-warning-text">
            <p>
              {pending === "replace"
                ? "Make a new link? Your current link stops working straight away, so any calendar using it goes empty until you add the new one."
                : pending === "off"
                  ? "Turn the link off? Every calendar app using it stops updating. You can make a new link later, but you'd have to add it again."
                  : "You haven't copied your link. It won't be shown again, so you'd need to make a new one."}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button
                variant="danger"
                autoFocus
                disabled={busy}
                onClick={() => (pending === "replace" ? make() : pending === "off" ? turnOff() : onClose())}
              >
                {pending === "replace" ? "Yes, make a new link" : pending === "off" ? "Yes, turn it off" : "Close anyway"}
              </Button>
              <Button variant="outline" onClick={() => setPending(null)}>
                {pending === "close" ? "Go back" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {loaded && "link" in loaded && !pending && (
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button disabled={busy} onClick={make}>
              <Icon name={link ? "refresh" : "plus"} size={16} /> {link ? "Make a new link" : "Make my link"}
            </Button>
            {link && (
              <Button variant="outline" disabled={busy} onClick={turnOff}>
                Turn off
              </Button>
            )}
          </div>
        )}
        {link && !url && !pending && <p className="text-xs text-text-muted">Lost the link? Make a new one. The old one stops working straight away.</p>}
      </div>
    </Modal>
  );
}
