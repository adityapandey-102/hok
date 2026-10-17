"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";
import { BrandLockup } from "../../../components/shell/BrandMark";
import { LINK_INVALID, PortalApiError, publicPortalApi, type PortalDashboard, type PortalEvent } from "../api/publicPortalApi";
import { eventTypeLabel, formatEventWhen, stageSummary } from "../portalFormat";
import { PortalStageTrack } from "./PortalStageTrack";
import { PortalEventModal } from "./PortalEventModal";
import { PortalCalendar } from "./PortalCalendar";
import { PortalComments } from "./PortalComments";

/**
 * The client portal (FR-POR-03..09): a calm, read-mostly page for the client,
 * opened by the link their manager shared. The client's own name and logo are
 * the header; the current event is the hero with its stage rail. Everything is
 * in the client's time zone. No staff app chrome; the HOK logo appears small
 * in the footer only.
 */
export function PortalApp({ token }: { token: string }) {
  const [data, setData] = useState<PortalDashboard | null>(null);
  const [error, setError] = useState<PortalApiError | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="relative isolate overflow-hidden gradient-sidebar text-white">
        <div aria-hidden className="ambient-glow pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full" />
        <div aria-hidden className="absolute inset-0 -z-10 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(90deg,transparent,black_50%)]" />
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6 sm:px-6 sm:py-8">
          {data.client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the client's own logo URL (any host); a plain img avoids allow-listing every domain
            <img src={data.client.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-app-lg bg-white object-cover p-0.5 shadow-app-md sm:h-16 sm:w-16" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-app-lg bg-white font-serif text-2xl text-primary shadow-app-md sm:h-16 sm:w-16 sm:text-3xl">{data.client.businessName.charAt(0)}</div>
          )}
          <div className="min-w-0 grow">
            <p className="text-xs text-white/60">Your project dashboard</p>
            <h1 className="truncate font-serif text-[24px] leading-tight text-white sm:text-[30px]">{data.client.businessName}</h1>
            <p className="mt-0.5 text-xs text-white/60 sm:text-[13px]">
              Your account manager: <span className="text-white/85">{data.manager.firstName}</span> · Times shown in {zone.replace(/_/g, " ")}
            </p>
          </div>
          <ThemeToggle tone="on-dark" className="self-start" />
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section aria-labelledby="now-title">
          <h2 id="now-title" className="mb-3 font-serif text-[18px] text-text-primary">
            Happening now / next
          </h2>
          {data.current ? (
            <Card accent className="stagger-in p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-bg px-2.5 py-1 text-xs font-medium text-primary">
                    <span aria-hidden className="current-pulse h-2 w-2 rounded-full bg-primary" />
                    {stageSummary(data.current)}
                  </p>
                  <h3 className="font-serif text-[24px] leading-snug text-text-primary sm:text-[30px]">{data.current.title}</h3>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[15px] text-text-secondary">
                    <Icon name="calendar" size={15} className="shrink-0 text-text-muted" />
                    {formatEventWhen(data.current, zone)}
                  </p>
                  {data.current.location && <p className="mt-0.5 text-sm text-text-muted">{data.current.location}</p>}
                </div>
                <div className="flex gap-1.5">
                  <StatusPill label={eventTypeLabel(data.current.type)} tone="gray" />
                  {data.current.state !== "active" && <StatusPill label={data.current.state === "cancelled" ? "Cancelled" : "Postponed"} tone="red" />}
                </div>
              </div>
              <div className="mt-7">
                <PortalStageTrack stages={data.current.stages} currentPosition={data.current.currentStagePosition} />
              </div>
              <Button variant="outline" className="mt-6 max-sm:w-full" onClick={() => setOpenEventId(data.current!.id)}>
                <Icon name="history" size={15} /> See updates
              </Button>
            </Card>
          ) : (
            <Card>
              <EmptyState compact icon="calendar" title="Nothing scheduled right now" description="New events will appear here." />
            </Card>
          )}
        </section>

        <EventPanel icon="clock" title="Coming up" events={upcoming} zone={zone} onOpen={setOpenEventId} empty="No other upcoming events." />

        <PortalCalendar token={token} zone={zone} onOpen={setOpenEventId} />

        <EventPanel icon="check-circle" title="Recently finished" events={data.recent} zone={zone} onOpen={setOpenEventId} empty="Nothing finished yet." />

        <PortalComments token={token} zone={zone} events={choices} />

        <footer className="flex flex-col items-center gap-3 border-t border-border-light pt-6 pb-8 text-center">
          <p className="text-xs text-text-muted">This page is private to {data.client.businessName}. Please don&apos;t share the link.</p>
          <div className="flex items-center gap-2 text-text-muted">
            <span className="text-xs">Made by</span>
            <BrandLockup size={22} />
          </div>
        </footer>
      </main>

      <PortalEventModal token={token} zone={zone} eventId={openEventId} onClose={() => setOpenEventId(null)} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-app-bg px-6 text-center">{children}</div>;
}

/** A skeleton shaped like the page: header band, hero card, a list. */
function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-app-bg" aria-busy="true" aria-label="Loading your dashboard">
      <div className="gradient-sidebar">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6 sm:px-6 sm:py-8">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-app-lg bg-white/15 sm:h-16 sm:w-16" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-32 animate-pulse rounded bg-white/15" />
            <div className="h-6 w-56 max-w-full animate-pulse rounded bg-white/20" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="skeleton h-64 rounded-app-lg" />
        <div className="skeleton h-40 rounded-app-lg" />
        <div className="skeleton h-72 rounded-app-lg" />
      </div>
    </div>
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

function EventPanel({ icon, title, events: all, zone, onOpen, empty }: { icon: "clock" | "check-circle"; title: string; events: PortalEvent[]; zone: string; onOpen: (id: string) => void; empty: string }) {
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
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.id)} className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-accent-bg">
                  <EventDate iso={e.startsAt} zone={zone} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14.5px] font-medium text-text-primary ${e.state === "cancelled" ? "line-through opacity-60" : ""}`}>{e.title}</span>
                    <span className="block truncate text-xs text-text-muted">{formatEventWhen(e, zone)}</span>
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
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border-light px-5 py-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary"
        >
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </button>
      )}
    </Panel>
  );
}
