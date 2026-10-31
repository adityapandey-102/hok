"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Icon } from "../../../components/ui/Icon";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Select } from "../../../components/ui/Select";
import { EVENT_STATES, EVENT_STATE_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS, type ClientSummary } from "../../../lib/domain";
import { clientsApi } from "../../clients/api/clientsApi";
import { reportsApi, type ClientReport } from "../api/reportsApi";
import { formatHours, lastSixMonths, monthLabel, percent } from "../lib/reportFormat";
import { FigureBoard, LoadError, SectionIntro, SkeletonBoard, Spinner } from "./ReportParts";

const BOARD_COLUMNS = "grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 min-[1440px]:grid-cols-4";

/**
 * Client report (FR-RPT-04), step by step like the staff report: pick a client
 * (server-searched), then a month (the last 6), then the figures and small
 * visuals. The Admin sees every client.
 */
export function ClientReportClient({ timeZone }: { timeZone: string }) {
  const months = useMemo(() => lastSixMonths(new Date(), timeZone), [timeZone]);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [month, setMonth] = useState(months[0]!.value);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; report?: ClientReport; error?: string } | null>(null);

  const key = client ? `${client.id}|${month}|${reloadKey}` : "";
  const current = result?.key === key ? result : null;
  const shown = client ? (current?.report ?? (result?.report?.client.clientId === client.id ? result.report : null)) : null;
  const loading = Boolean(client) && !current;

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const forKey = `${client.id}|${month}|${reloadKey}`;
    reportsApi
      .client(client.id, month)
      .then((report) => !cancelled && setResult({ key: forKey, report }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the report." }));
    return () => {
      cancelled = true;
    };
  }, [client, month, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);
  const label = monthLabel(month);

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro id="client-report-heading" title="Client report" description="One client's month: events held, comments answered and how fast, to-dos and assets." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <Card className={client ? "hidden lg:block" : ""} regionLabel="Choose a client">
          <CardHeader icon={<Icon name="briefcase" size={17} />} title="Choose a client" subtitle="Then see their month" />
          <CardBody>
            <SearchSelect<ClientSummary>
              aria-label="Client"
              placeholder="Search clients…"
              value={client?.id ?? null}
              selectedLabel={client?.name}
              load={clientsApi.searchOptions}
              onChange={(id, item) => {
                setClient(id && item ? { id, name: item.label } : null);
                setMonth(months[0]!.value);
              }}
            />
          </CardBody>
        </Card>

        <div className={`min-w-0 ${client ? "" : "hidden lg:block"}`}>
          {!client ? (
            <div className="rounded-app-lg border border-dashed border-border bg-card/60">
              <EmptyState icon="briefcase" title="Pick a client to see their month" description="Events and their stages, client comments and reply time, to-dos done and assets added." />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button type="button" onClick={() => setClient(null)} className="inline-flex items-center gap-1 self-start text-sm font-medium text-text-secondary hover:text-text-primary hover:underline lg:hidden">
                <Icon name="chevron-right" size={15} className="rotate-180" />
                Choose another client
              </button>

              {!shown && current?.error ? (
                <LoadError title="Couldn't load this report" message={current.error} onRetry={retry} />
              ) : !shown ? (
                <>
                  <div className="skeleton h-[72px] rounded-app-lg" aria-hidden />
                  <SkeletonBoard cells={8} columns={BOARD_COLUMNS} />
                  <div className="skeleton h-64 rounded-app-lg" aria-label="Loading" />
                </>
              ) : (
                <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-app bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
                        <Icon name="briefcase" size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-serif text-lg leading-snug text-text-primary">{shown.client.name}</h3>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                          Managed by {shown.client.ownerName}
                          <Link href={`/app/clients/${shown.client.clientId}`} className="font-medium text-text-secondary hover:text-text-primary hover:underline">
                            Open client
                          </Link>
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        {loading && <Spinner label="Loading the month" />}
                        <Select aria-label="Month" className="sm:w-48" value={month} onChange={(e) => setMonth(e.target.value)}>
                          {months.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {current?.error && (
                    <p role="alert" className="flex items-center justify-between gap-3 rounded-app border border-error/25 bg-error-bg/40 px-4 py-2 text-sm text-error">
                      <span>{current.error}</span>
                      <button type="button" onClick={retry} className="font-semibold underline">
                        Retry
                      </button>
                    </p>
                  )}

                  <ClientFigures report={shown} label={label} />
                  <ClientVisuals report={shown} label={label} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientFigures({ report: r, label }: { report: ClientReport; label: string }) {
  return (
    <FigureBoard
      label={`${r.client.name}, ${label}`}
      columns={BOARD_COLUMNS}
      figures={[
        { key: "events", icon: "calendar", label: "Events", value: r.events.total, caption: "Started this month" },
        { key: "moves", icon: "layers", label: "Stage moves", value: r.stageMoves, caption: "Made on their events" },
        { key: "received", icon: "message", label: "Comments", value: r.comments.received, caption: "Received from the client" },
        { key: "solved", icon: "check-circle", label: "Solved", value: r.comments.solved, tone: "success", caption: `${percent(r.comments.solved, r.comments.received)}% of received` },
        { key: "reply", icon: "clock", label: "First reply", value: formatHours(r.comments.avgFirstReplyHours), caption: r.comments.replied > 0 ? `Average over ${r.comments.replied} answered` : "No comment answered" },
        { key: "done", icon: "clipboard", label: "To-dos done", value: r.todos.done, tone: "success", caption: "Finished this month" },
        { key: "open", icon: "inbox", label: "To-dos open", value: r.todos.open, caption: "Not done yet" },
        { key: "assets", icon: "tag", label: "Assets added", value: r.assetsAdded, caption: "Links saved this month" },
      ]}
    />
  );
}

/** A labelled horizontal bar; `max` is the scale shared by the rows of one chart. */
function BarRow({ label, value, max, tone = "var(--color-text-secondary)" }: { label: string; value: number; max: number; tone?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
      <span className="truncate text-text-secondary">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-accent-bg" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0}%`, background: tone }} />
      </span>
      <span className="figure text-right text-text-primary">{value}</span>
    </li>
  );
}

/** A two-part bar (e.g. done vs open) with its legend. */
function SplitBar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-accent-bg" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${total > 0 ? (p.value / total) * 100 : 0}%`, background: p.tone }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-text-secondary">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: p.tone }} />
            {p.label}
            <span className="figure text-text-primary">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClientVisuals({ report: r, label }: { report: ClientReport; label: string }) {
  const stateMax = Math.max(1, ...EVENT_STATES.map((s) => r.events.byState[s]));
  const typeMax = Math.max(1, ...EVENT_TYPES.map((t) => r.events.byType[t]));
  const tones = { active: "var(--color-success)", cancelled: "var(--color-error)", postponed: "var(--color-warning)" } as const;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card regionLabel="Events">
        <CardHeader icon={<Icon name="calendar" size={17} />} title="Events" subtitle={`${r.events.total} started in ${label}`} />
        <CardBody>
          {r.events.total === 0 ? (
            <EmptyState compact icon="calendar" title="No events started" description="Nothing began in this month." />
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">By state</p>
                <ul className="flex flex-col gap-2.5">
                  {EVENT_STATES.map((s) => (
                    <BarRow key={s} label={EVENT_STATE_LABELS[s]} value={r.events.byState[s]} max={stateMax} tone={tones[s]} />
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">By type</p>
                <ul className="flex flex-col gap-2.5">
                  {EVENT_TYPES.map((t) => (
                    <BarRow key={t} label={EVENT_TYPE_LABELS[t]} value={r.events.byType[t]} max={typeMax} />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-4">
        <Card regionLabel="Client comments">
          <CardHeader icon={<Icon name="message" size={17} />} title="Client comments" subtitle={`${r.comments.received} received in ${label}`} />
          <CardBody>
            {r.comments.received === 0 ? (
              <EmptyState compact icon="message" title="No comments" description="The client left no comments this month." />
            ) : (
              <div className="flex flex-col gap-4">
                <SplitBar
                  parts={[
                    { label: "Answered", value: r.comments.replied, tone: "var(--color-success)" },
                    { label: "Not answered", value: r.comments.received - r.comments.replied, tone: "var(--color-warning)" },
                  ]}
                />
                <p className="text-sm text-text-secondary">
                  Average first reply: <span className="font-semibold text-text-primary">{formatHours(r.comments.avgFirstReplyHours)}</span>
                  <span className="text-text-muted"> · {r.comments.solved} solved</span>
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card regionLabel="To-dos">
          <CardHeader icon={<Icon name="clipboard" size={17} />} title="To-dos" subtitle="Done this month vs still open" />
          <CardBody>
            {r.todos.done + r.todos.open === 0 ? (
              <EmptyState compact icon="clipboard" title="No to-dos" description="Nothing finished this month and nothing open." />
            ) : (
              <SplitBar
                parts={[
                  { label: "Done", value: r.todos.done, tone: "var(--color-success)" },
                  { label: "Open", value: r.todos.open, tone: "var(--color-text-muted)" },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
