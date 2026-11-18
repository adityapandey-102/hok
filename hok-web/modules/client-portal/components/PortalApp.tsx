"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { Segmented } from "../../../components/ui/Segmented";
import { StatusPill } from "../../../components/ui/StatusPill";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";
import { LinkifiedText } from "../../../components/ui/LinkifiedText";
import { BrandLockup } from "../../../components/shell/BrandMark";
import { LINK_INVALID, PortalApiError, publicPortalApi, type PortalDashboard, type PortalEvent } from "../api/publicPortalApi";
import { eventTypeLabel, formatEventWhen, stageSummary } from "../portalFormat";
import { PORTAL_TABS, shouldRipple, tabFromHash, type PortalFocus, type PortalTabId } from "../portalLogic";
import { useLastVisit } from "../portalVisit";
import { PortalStageTrack } from "./PortalStageTrack";
import { PortalEventModal } from "./PortalEventModal";
import { PortalFilesTag } from "./PortalFilesTag";
import { PortalCalendar } from "./PortalCalendar";
import { PortalComments } from "./PortalComments";

/** The current tab lives in the URL hash (#calendar, #messages) so refresh and the back button keep it. */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The client portal (FR-POR-03..09): a calm page for the client, opened by the link their manager
 * shared. Round 5 made it answer two questions within three seconds: what needs me, and what is new.
 * Header, sticky tabs (Overview, Calendar, Messages), and on the Overview: the current project with its
 * steps, then what is coming up and what is finished. Approvals and shared files show on the event
 * cards and rows only (an amber chip, a green "N files shared" tag), never in a separate list. Everything is in
 * the client's time zone. The HOK logo appears small in the footer only.
 */
export function PortalApp({ token }: { token: string }) {
  const [data, setData] = useState<PortalDashboard | null>(null);
  const [error, setError] = useState<PortalApiError | null>(null);
  const [open, setOpen] = useState<{ id: string; focus?: PortalFocus } | null>(null);
  const lastVisit = useLastVisit(token);
  const tab = useSyncExternalStore(subscribeHash, () => tabFromHash(window.location.hash), () => "overview" as PortalTabId);

  const load = useCallback(() => {
    let cancelled = false;
    publicPortalApi
      .dashboard(token)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof PortalApiError ? e : new PortalApiError("Something went wrong.", 0, null)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => load(), [load]);

  if (error?.code === LINK_INVALID) {
    return (
      <Centered>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-bg ring-8 ring-accent-bg/50">
          <Icon name="lock" size={24} className="text-text-muted" />
        </span>
        <h1 className="mt-5 font-serif text-[24px] text-text-primary">This link isn&apos;t active</h1>
        <p className="mt-2 max-w-sm text-sm text-text-secondary">It may have been replaced or switched off. Please ask your account manager for a new link.</p>
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <p className="text-sm text-text-secondary" role="alert">
          {error.message}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setError(null);
            load();
          }}
        >
          Try again
        </Button>
      </Centered>
    );
  }
  if (!data) return <PortalSkeleton />;

  const zone = data.client.timeZone;
  const choices = [...(data.current ? [data.current] : []), ...data.upcoming, ...data.recent].filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);
  const upcoming = data.upcoming.filter((e) => e.id !== data.current?.id);
  const openEvent = (id: string, focus?: PortalFocus) => setOpen({ id, focus });

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="relative isolate overflow-hidden gradient-sidebar text-white">
        <div aria-hidden className="ambient-glow pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full" />
        <div aria-hidden className="absolute inset-0 -z-10 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(90deg,transparent,black_50%)]" />
        <div className="mx-auto flex max-w-4xl items-center gap-3.5 px-4 py-5 sm:px-6">
          {data.client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the client's own logo URL (any host); a plain img avoids allow-listing every domain
            <img src={data.client.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-app-lg bg-white object-cover p-0.5 shadow-app-md sm:h-14 sm:w-14" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-app-lg bg-white font-serif text-2xl text-primary shadow-app-md sm:h-14 sm:w-14">{data.client.businessName.charAt(0)}</div>
          )}
          <div className="min-w-0 grow">
            <p className="text-xs text-white/60">Your project dashboard</p>
            <h1 className="truncate font-serif text-[22px] leading-tight text-white sm:text-[28px]">{data.client.businessName}</h1>
            <p className="mt-0.5 text-xs text-white/60 sm:text-[13px]">
              Your account manager: <span className="text-white/85">{data.manager.firstName}</span> · Times shown in {zone.replace(/_/g, " ")}
            </p>
          </div>
          <ThemeToggle tone="on-dark" className="self-start" />
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-border-light bg-card">
        <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6">
          <Segmented
            stretch
            idPrefix="portal"
            label="Portal sections"
            options={PORTAL_TABS}
            value={tab}
            onChange={(id) => {
              window.location.hash = id;
            }}
          />
        </div>
      </div>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div role="tabpanel" aria-labelledby={`portal-tab-${tab}`} className="flex flex-col gap-6">
          {tab === "overview" && (
            <>
              <section aria-labelledby="now-title">
                <h2 id="now-title" className="mb-3 px-1 text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
                  Your current project
                </h2>
                {data.current ? <CurrentProject event={data.current} zone={zone} lastVisit={lastVisit} onOpen={openEvent} /> : (
                  <Card>
                    <EmptyState compact icon="calendar" title="Nothing scheduled right now" description="New events will appear here." />
                  </Card>
                )}
              </section>

              <EventPanel icon="clock" title="Coming up" events={upcoming} zone={zone} lastVisit={lastVisit} onOpen={openEvent} empty="No other upcoming events." />
              <EventPanel icon="check-circle" title="Recently finished" events={data.recent} zone={zone} lastVisit={lastVisit} onOpen={openEvent} empty="Nothing finished yet." />
            </>
          )}
          {tab === "calendar" && <PortalCalendar token={token} zone={zone} onOpen={(id) => openEvent(id)} />}
          {tab === "messages" && <PortalComments token={token} zone={zone} events={choices} />}
        </div>

        <footer className="flex flex-col items-center gap-3 border-t border-border-light pt-6 pb-8 text-center">
          <p className="text-xs text-text-muted">This page is private to {data.client.businessName}. Please don&apos;t share the link.</p>
          <div className="flex items-center gap-2 text-text-muted">
            <span className="text-xs">Made by</span>
            <BrandLockup size={22} />
          </div>
        </footer>
      </main>

      <PortalEventModal token={token} zone={zone} eventId={open?.id ?? null} focus={open?.focus} lastVisit={lastVisit} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-app-bg px-6 text-center">{children}</div>;
}

/** A skeleton shaped like the page: header band, tabs, attention, hero card. */
function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-app-bg" aria-busy="true" aria-label="Loading your dashboard">
      <div className="gradient-sidebar">
        <div className="mx-auto flex max-w-4xl items-center gap-3.5 px-4 py-5 sm:px-6">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-app-lg bg-white/15 sm:h-14 sm:w-14" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-32 animate-pulse rounded bg-white/15" />
            <div className="h-6 w-56 max-w-full animate-pulse rounded bg-white/20" />
          </div>
        </div>
      </div>
      <div className="border-b border-border-light bg-card py-2">
        <div className="skeleton mx-auto h-9 max-w-4xl rounded-app" />
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="skeleton h-32 rounded-app-lg" />
        <div className="skeleton h-64 rounded-app-lg" />
        <div className="skeleton h-40 rounded-app-lg" />
      </div>
    </div>
  );
}

/** "Your current project": its title and when, the chips that need or hold something, and its steps (each opens the event at that step). */
function CurrentProject({ event, zone, lastVisit, onOpen }: { event: PortalEvent; zone: string; lastVisit: number | null; onOpen: (id: string, focus?: PortalFocus) => void }) {
  const awaiting = event.awaitingYourApproval;
  return (
    <Card accent className="stagger-in p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-bg px-2.5 py-1 text-xs font-medium text-primary">
            <span aria-hidden className="current-pulse h-2 w-2 rounded-full bg-primary" />
            {stageSummary(event)}
          </p>
          <h3 className="font-serif text-[24px] leading-snug text-text-primary sm:text-[30px]">{event.title}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-[15px] text-text-secondary">
            <Icon name="calendar" size={15} className="shrink-0 text-text-muted" />
            {formatEventWhen(event, zone)}
          </p>
          {event.location && (
            <p className="mt-0.5 text-sm break-words text-text-muted">
              <LinkifiedText text={event.location} />
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <StatusPill label={eventTypeLabel(event.type)} tone="gray" />
          {event.state !== "active" && <StatusPill label={event.state === "cancelled" ? "Cancelled" : "Postponed"} tone="red" />}
        </div>
      </div>

      {(awaiting || event.fileCount > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {awaiting && (
            <button
              type="button"
              onClick={() => onOpen(event.id, "approval")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-warning-bg px-4 text-[13.5px] font-semibold text-warning-text transition-opacity hover:opacity-80 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none"
            >
              <Icon name="shield" size={15} /> Needs your approval
            </button>
          )}
          {event.fileCount > 0 && <PortalFilesTag size="md" count={event.fileCount} ripple={shouldRipple(event.latestFileAt, lastVisit)} onClick={() => onOpen(event.id, "files")} />}
        </div>
      )}

      <div className="mt-6">
        <PortalStageTrack
          stages={event.stages}
          currentPosition={event.currentStagePosition}
          approvalStagePosition={awaiting ? event.approvalStagePosition : null}
          fileStages={event.fileStages}
          onStepClick={(position) => onOpen(event.id, { step: position })}
          summaryChips={false}
        />
      </div>

      <Button variant="primary" className="mt-6 min-h-11 max-sm:w-full" onClick={() => onOpen(event.id, awaiting ? "approval" : undefined)}>
        <Icon name={awaiting ? "shield" : "history"} size={15} /> {awaiting ? "Review and approve" : "Open project"}
      </Button>
    </Card>
  );
}

function EventDate({ iso, zone }: { iso: string; zone: string }) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: zone }).format(d);
  const mon = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: zone }).format(d);
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-app bg-accent-bg ring-1 ring-border ring-inset">
      <span className="figure text-[16px] leading-none text-text-primary">{day}</span>
      <span className="mt-0.5 text-[10.5px] leading-none text-text-muted">{mon}</span>
    </span>
  );
}

const PREVIEW = 5;

function EventPanel({ icon, title, events: all, zone, lastVisit, onOpen, empty }: { icon: "clock" | "check-circle"; title: string; events: PortalEvent[]; zone: string; lastVisit: number | null; onOpen: (id: string, focus?: PortalFocus) => void; empty: string }) {
  const [showAll, setShowAll] = useState(false);
  const events = showAll ? all : all.slice(0, PREVIEW);
  return (
    <Panel icon={icon} title={title} subtitle={all.length > 0 ? `${all.length} ${all.length === 1 ? "event" : "events"}` : undefined}>
      {all.length === 0 ? (
        <EmptyState compact icon="calendar" title={empty} />
      ) : (
        <ul className="divide-y divide-border-light">
          {events.map((e) => {
            const pct = e.stageCount > 0 ? Math.round((e.currentStagePosition / e.stageCount) * 100) : 0;
            return (
              <li key={e.id} className="group relative flex min-h-16 items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-accent-bg">
                <EventDate iso={e.startsAt} zone={zone} />
                <span className="min-w-0 flex-1">
                  {/* The title button is stretched over the whole row (after:inset-0); the files tag sits above it. */}
                  <button type="button" onClick={() => onOpen(e.id)} className="block w-full text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-ring/25">
                    <span className={`block truncate text-[14.5px] font-medium text-text-primary ${e.state === "cancelled" ? "line-through opacity-60" : ""}`}>{e.title}</span>
                    <span className="block truncate text-xs text-text-muted">{formatEventWhen(e, zone)}</span>
                  </button>
                  {(e.awaitingYourApproval || e.fileCount > 0) && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {e.awaitingYourApproval && <span className="inline-flex rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning-text">Needs approval</span>}
                      {e.fileCount > 0 && <PortalFilesTag count={e.fileCount} ripple={shouldRipple(e.latestFileAt, lastVisit)} onClick={() => onOpen(e.id, "files")} />}
                    </span>
                  )}
                  <span className="mt-1.5 flex items-center gap-2 sm:hidden">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-light">
                      <span className="grow-x block h-full rounded-full bg-ink" style={{ width: `${Math.max(pct, 6)}%` }} />
                    </span>
                    <span className="text-[11px] text-text-muted">{stageSummary(e)}</span>
                  </span>
                </span>
                <span className="hidden w-44 shrink-0 sm:block">
                  <span className="flex justify-between gap-2 text-[11.5px] text-text-secondary">
                    <span className="truncate">{stageSummary(e)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border-light">
                    <span className="grow-x block h-full rounded-full bg-ink" style={{ width: `${Math.max(pct, 6)}%` }} />
                  </span>
                </span>
                <span className="hidden shrink-0 gap-1.5 md:flex">
                  <StatusPill label={eventTypeLabel(e.type)} tone="gray" />
                  {e.state !== "active" && <StatusPill label={e.state === "cancelled" ? "Cancelled" : "Postponed"} tone="red" />}
                </span>
                <Icon name="chevron-right" size={15} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </li>
            );
          })}
        </ul>
      )}
      {all.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border-light px-5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary"
        >
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </button>
      )}
    </Panel>
  );
}
