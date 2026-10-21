"use client";

import { useEffect, useRef, useState } from "react";
import { calendarFeedApi, feedUrl, googleSubscribeUrl, isLocalAddress, type FeedLink } from "../calendarApi";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Modal } from "../../../components/ui/Modal";
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

function SubscribeDialog({ timeZone, onClose }: { timeZone: string; onClose: () => void }) {
  const { showToast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function make() {
    setBusy(true);
    try {
      const res = await calendarFeedApi.create();
      setLoaded({ link: res.link });
      setUrl(feedUrl(res.token));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not make the link", "error");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
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

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied.", "success");
    } catch {
      showToast("Could not copy. Select the link and copy it by hand.", "error");
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="subscribe-title" initialFocusRef={closeRef} panelClassName="sm:max-w-xl">
      <div className="flex items-center gap-3 border-b border-border-light px-5 py-4">
        <Icon name="calendar" size={18} className="text-primary" />
        <h2 id="subscribe-title" className="font-serif text-lg text-text-primary">
          Add to Google Calendar
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-app p-1.5 text-text-muted hover:bg-accent-bg">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 text-sm text-text-secondary">
        <p>
          See your HOK calendar inside Google Calendar (or Apple Calendar, Outlook). It shows the last 30 days and the next 6 months, and updates on its own. Google
          refreshes it every few hours.
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
          <div className="animate-rise rounded-app-lg border border-primary/25 bg-primary-bg p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Icon name="lock" size={13} /> Keep it private: anyone with this link can see your calendar. It is shown only this once.
            </p>
            <p data-testid="feed-url" className="mt-2 rounded-app bg-card p-2.5 break-all text-text-primary ring-1 ring-border ring-inset">
              {url}
            </p>
            {isLocalAddress(url) && (
              <p className="mt-2 text-xs text-warning-text">This copy of HOK runs on this computer, so Google can&apos;t reach it yet. The link works once HOK is online.</p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <a
                href={googleSubscribeUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-app bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink hover:bg-ink-hover"
              >
                <Icon name="external-link" size={16} /> Open Google Calendar
              </a>
              <Button variant="outline" onClick={copy}>
                <Icon name="copy" size={16} /> Copy link
              </Button>
            </div>
            <p className="mt-3 text-xs text-text-muted">Other apps: copy the link, then use “Subscribe to calendar” / “Add calendar from URL”.</p>
          </div>
        )}

        {loaded && "link" in loaded && (
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
        {link && !url && <p className="text-xs text-text-muted">Lost the link? Make a new one. The old one stops working straight away.</p>}
      </div>
    </Modal>
  );
}
