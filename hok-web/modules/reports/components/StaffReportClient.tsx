"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Icon } from "../../../components/ui/Icon";
import { LastSeen } from "../../../components/ui/LastSeen";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Select } from "../../../components/ui/Select";
import { ROLE_LABELS } from "../../../lib/domain";
import type { SelectOption } from "../../../lib/api/options";
import { usersApi, type UserAccount } from "../../admin-users/api/usersApi";
import { reportsApi, type StaffReport } from "../api/reportsApi";
import { formatDays, lastSixMonths, monthLabel, percent } from "../lib/reportFormat";
import { Avatar, FigureBoard, LoadError, SectionIntro, SkeletonBoard, Spinner } from "./ReportParts";
import { WeeklyChart } from "./WeeklyChart";

// Beside the person picker (lg+) the board is narrow: two across until the screen is wide.
const BOARD_COLUMNS = "grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 min-[1440px]:grid-cols-4";

/** People for the picker: the users API (Admin), server-searched, 20 rows, with the role as the hint. */
async function searchPeople(search: string): Promise<SelectOption<UserAccount>[]> {
  const rows = await usersApi.searchOptions(search);
  return rows.map((o) => ({ ...o, hint: o.data ? ROLE_LABELS[o.data.role] : o.hint }));
}

/**
 * Staff report (FR-RPT-03), loaded step by step: pick a person, then a month
 * (the last 6, newest first), then their figures and weekly chart. Nothing
 * loads until a person is chosen; a report loads only for the month shown.
 *
 * Layout: from lg the picker and the report sit side by side; on phones and
 * tablets it is one step at a time, with a way back to the picker.
 */
export function StaffReportClient({ timeZone }: { timeZone: string }) {
  const months = useMemo(() => lastSixMonths(new Date(), timeZone), [timeZone]);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [month, setMonth] = useState(months[0]!.value);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; report?: StaffReport; error?: string } | null>(null);

  const key = person ? `${person.id}|${month}|${reloadKey}` : "";
  const current = result?.key === key ? result : null;
  // Keep the last report on screen while the next month loads (no flash of empty).
  const shown = person ? (current?.report ?? (result?.report?.person.userId === person.id ? result.report : null)) : null;
  const loading = Boolean(person) && !current;

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    const forKey = `${person.id}|${month}|${reloadKey}`;
    reportsApi
      .staff(person.id, month)
      .then((report) => !cancelled && setResult({ key: forKey, report }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the report." }));
    return () => {
      cancelled = true;
    };
  }, [person, month, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);
  const label = monthLabel(month);

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro id="staff-report-heading" title="Staff report" description="One person's month: tasks assigned and finished, on time or late, and week by week." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        {/* Step 1. On phones and tablets it gives way to the report once someone is picked. */}
        <Card className={person ? "hidden lg:block" : ""} regionLabel="Choose a person">
          <CardHeader icon={<Icon name="users" size={17} />} title="Choose a person" subtitle="Then see their month" />
          <CardBody>
            <SearchSelect<UserAccount>
              aria-label="Person"
              placeholder="Search people…"
              value={person?.id ?? null}
              selectedLabel={person?.name}
              load={searchPeople}
              onChange={(id, item) => {
                setPerson(id && item ? { id, name: item.label } : null);
                setMonth(months[0]!.value);
              }}
            />
          </CardBody>
        </Card>

        <div className={`min-w-0 ${person ? "" : "hidden lg:block"}`}>
          {!person ? (
            <div className="rounded-app-lg border border-dashed border-border bg-card/60">
              <EmptyState icon="bar-chart" title="Pick a person to see their month" description="Tasks assigned and finished, on time or late, average time to finish, and a week-by-week chart." />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button type="button" onClick={() => setPerson(null)} className="inline-flex items-center gap-1 self-start text-sm font-medium text-text-secondary hover:text-text-primary hover:underline lg:hidden">
                <Icon name="chevron-right" size={15} className="rotate-180" />
                Choose another person
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
                      <Avatar name={shown.person.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-serif text-lg leading-snug text-text-primary">{shown.person.name}</h3>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                          {ROLE_LABELS[shown.person.role]}
                          <LastSeen at={shown.person.lastSeenAt} />
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

                  <StaffFigures report={shown} label={label} />

                  <Card>
                    <CardHeader icon={<Icon name="trending-up" size={17} />} title="Week by week" subtitle={`Assigned vs completed · ${label}`} />
                    <CardBody>
                      {shown.assigned === 0 && shown.completed === 0 ? (
                        <EmptyState compact icon="clipboard" title="No tasks in this month" description="Nothing was assigned to or finished by this person." />
                      ) : (
                        <WeeklyChart weeks={shown.weeks} />
                      )}
                    </CardBody>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffFigures({ report: r, label }: { report: StaffReport; label: string }) {
  const rate = percent(r.onTime, r.completed);
  return (
    <FigureBoard
      label={`${r.person.name}, ${label}`}
      columns={BOARD_COLUMNS}
      figures={[
        { key: "assigned", icon: "clipboard", label: "Assigned", value: r.assigned, caption: "Given to them this month" },
        { key: "completed", icon: "check-circle", label: "Completed", value: r.completed, tone: "success", caption: "Finished this month" },
        { key: "ontime", icon: "clock", label: "On time", value: r.onTime, tone: "success", caption: r.completed > 0 ? `${rate}% of completed` : "Nothing completed" },
        { key: "late", icon: "alert", label: "Late", value: r.late, tone: r.late > 0 ? "warning" : "default", caption: "Finished after the due date" },
        { key: "avg", icon: "history", label: "Average to finish", value: formatDays(r.avgDaysToComplete), caption: "From assigned to done" },
        { key: "rate", icon: "trending-up", label: "On-time rate", value: r.completed > 0 ? `${rate}%` : "–", caption: "Of completed tasks" },
        { key: "open", icon: "inbox", label: "Open now", value: r.openNow, caption: "Not done yet" },
        { key: "overdue", icon: "alert", label: "Overdue now", value: r.overdueNow, tone: r.overdueNow > 0 ? "error" : "default", caption: "Past their due date" },
      ]}
    />
  );
}
