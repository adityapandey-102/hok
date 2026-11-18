"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader } from "../../../components/ui/Loader";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { LinkifiedText } from "../../../components/ui/LinkifiedText";
import { StatusPill } from "../../../components/ui/StatusPill";
import { publicPortalApi, type PortalEventDetail } from "../api/publicPortalApi";
import { approvalHistoryLabel, eventTypeLabel, formatEventWhen, formatLongDate, formatShortDate, stageSummary } from "../portalFormat";
import { portalAssetIcon, portalAssetLabel } from "../portalAssets";
import { focusTargetId, groupFilesByStep, safeHttpUrl, shouldRipple, type PortalFocus } from "../portalLogic";
import { PortalStageTrack } from "./PortalStageTrack";
import { PortalApprovalBox } from "./PortalApprovalBox";
import { PortalEventComments } from "./PortalEventComments";
import { PortalFilesTag } from "./PortalFilesTag";

/** One event with what the manager chose to share (FR-POR-06), loaded when opened. A full-screen sheet on phones, a modal from tablets up. */
export function PortalEventModal({
  token,
  zone,
  eventId,
  focus,
  lastVisit,
  onClose,
  onChanged,
}: {
  token: string;
  zone: string;
  eventId: string | null;
  /** Where to scroll when it opens: the approval, the shared files, or one step's files. */
  focus?: PortalFocus;
  lastVisit?: number | null;
  onClose: () => void;
  /** After the client answered an approval: the dashboard behind the modal refreshes. */
  onChanged?: () => void;
}) {
  return (
    <Modal open={eventId !== null} onClose={onClose} labelledBy="portal-event-title" panelClassName="max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none sm:max-w-xl">
      {eventId && <EventBody key={eventId} token={token} zone={zone} eventId={eventId} focus={focus} lastVisit={lastVisit} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

function EventBody({ token, zone, eventId, focus, lastVisit, onClose, onChanged }: { token: string; zone: string; eventId: string; focus?: PortalFocus; lastVisit?: number | null; onClose: () => void; onChanged?: () => void }) {
  const [event, setEvent] = useState<PortalEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // After an answer: a thank-you stays in place of the box while the event is fetched again.
  const [thanks, setThanks] = useState<"approve" | "changes" | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicPortalApi
      .event(token, eventId)
      .then((r) => !cancelled && setEvent(r.event))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load this event."));
    return () => {
      cancelled = true;
    };
  }, [token, eventId, reloadKey]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[88vh]">
      {error && (
        <p className="p-5 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && !event && (
        <div className="flex justify-center py-8">
          <Loader label="Loading" />
        </div>
      )}
      {event && (
        <PortalEventView
          event={event}
          token={token}
          zone={zone}
          focus={focus}
          lastVisit={lastVisit}
          thanks={thanks}
          onDecided={(decision) => {
            setThanks(decision);
            setReloadKey((k) => k + 1);
            onChanged?.();
          }}
          onStale={() => setReloadKey((k) => k + 1)}
          onClose={onClose}
        />
      )}
      {!event && (
        <div className="flex justify-end p-5 pt-0 max-sm:[&>button]:w-full">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The event as the client reads it, top to bottom: title and when; "Your action" (the approval, when
 * one waits); "Shared with you" grouped by step (the step awaiting approval first, then the current
 * step); "Progress"; "Updates"; "Approval history" (folded away when it has more than 3 entries).
 */
export function PortalEventView({
  event,
  token,
  zone,
  focus,
  lastVisit,
  thanks = null,
  onDecided,
  onStale,
  onClose,
}: {
  event: PortalEventDetail;
  token: string;
  zone: string;
  focus?: PortalFocus;
  /** This browser's previous visit (ms): the files tag ripples only for files newer than it. */
  lastVisit?: number | null;
  thanks?: "approve" | "changes" | null;
  onDecided: (decision: "approve" | "changes") => void;
  onStale: () => void;
  onClose: () => void;
}) {
  const pending = event.pendingApproval ?? null;
  const history = event.approvalHistory ?? [];
  const groups = useMemo(() => groupFilesByStep(event.assets, event.stages, event.approvalStagePosition, event.currentStagePosition), [event]);
  const target = focusTargetId(focus, pending !== null || thanks !== null, groups);

  const goToComment = () => {
    document.getElementById("pe-comment")?.scrollIntoView({ block: "center" });
    document.getElementById("pe-comment-text")?.focus({ preventScroll: true });
  };
  const goToFiles = () => document.getElementById("pe-files")?.scrollIntoView({ block: "start" });
  const goToApproval = () => document.getElementById("pe-approval")?.scrollIntoView({ block: "start" });

  // Open at the part the client asked for (a "Review" button, a step, a file's details, "Comment"). Runs once, when the event first shows.
  useEffect(() => {
    if (focus === "comment") goToComment();
    else if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first show; later reloads must not yank the scroll
  }, []);

  const scrollToStep = groups.length > 0 ? (position: number) => document.getElementById(groups.some((g) => g.step === position) ? `pe-step-${position}` : "pe-files")?.scrollIntoView({ block: "start", behavior: "smooth" }) : undefined;

  return (
    <div className="px-5 pb-6 sm:px-6">
      {/* Only the title bar sticks, so it never covers more than a line of the sheet. */}
      <div className="sticky top-0 z-30 -mx-5 flex items-center justify-between gap-3 bg-card px-5 pt-2 pb-1 sm:-mx-6 sm:px-6 sm:pt-4">
        <h2 id="portal-event-title" className="min-w-0 line-clamp-2 font-serif text-[21px] leading-snug text-text-primary">
          {event.title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close event" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
          <Icon name="x" size={20} />
        </button>
      </div>
      <div>
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{formatEventWhen(event, zone)}</p>
          {event.location && (
            <p className="text-xs break-words text-text-muted">
              <LinkifiedText text={event.location} />
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill label={eventTypeLabel(event.type)} tone="gray" />
            {event.state !== "active" && <StatusPill label={event.state === "cancelled" ? "Cancelled" : "Postponed"} tone="red" />}
            <StatusPill label={stageSummary(event)} tone="pink" />
            {event.assets.length > 0 && <PortalFilesTag count={event.assets.length} ripple={shouldRipple(event.latestFileAt, lastVisit ?? null)} onClick={goToFiles} />}
            <button type="button" onClick={goToComment} className="inline-flex items-center gap-1 rounded-full bg-primary-bg px-2.5 py-0.5 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
              <Icon name="message" size={12} /> Comment
            </button>
          </div>
        </div>
      </div>

      {(thanks || pending) && (
        <div id="pe-approval" className="scroll-mt-16">
          {thanks ? (
            <p data-testid="portal-approval-thanks" role="status" className="mt-2 flex items-start gap-2 rounded-app-lg bg-success-bg p-4 text-sm text-success">
              <Icon name="check-circle" size={17} className="mt-0.5 shrink-0" />
              <span>{thanks === "approve" ? "Thank you, your approval is saved." : "Thank you, we have your changes and will get back to you."}</span>
            </p>
          ) : (
            pending && (
              <>
                <h3 className="mt-2 mb-1 text-[13px] font-semibold tracking-wide text-warning-text uppercase">Your action</h3>
                <PortalApprovalBox token={token} zone={zone} approval={pending} onDecided={onDecided} onStale={onStale} />
              </>
            )
          )}
        </div>
      )}

      {groups.length > 0 && (
        <section id="pe-files" aria-label="Shared with you" className="mt-7 scroll-mt-16">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-[17px] text-text-primary">
            Shared with you
            <span className="rounded-full bg-success-bg px-2 py-0.5 font-sans text-xs font-semibold text-success">
              {event.assets.length} {event.assets.length === 1 ? "file" : "files"}
            </span>
          </h3>
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key} id={`pe-${g.key}`} className="scroll-mt-16">
                <h4 className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-text-secondary">
                  {g.title}
                  <span className="rounded-full bg-accent-bg px-2 py-0.5 text-[11px] font-medium">{g.files.length}</span>
                  {g.step !== null && g.step === event.approvalStagePosition && event.awaitingYourApproval && <StatusPill label="Needs your approval" tone="amber" />}
                </h4>
                <ul className="flex flex-col divide-y divide-border-light overflow-hidden rounded-app border border-border-light">
                  {g.files.map((a) => {
                    const href = safeHttpUrl(a.url);
                    const row = (
                      <>
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app bg-accent-bg text-text-secondary">
                          <Icon name={portalAssetIcon(a.type)} size={18} />
                        </span>
                        <span className="min-w-0 flex-1 basis-40">
                          <span className="block text-[15px] leading-snug font-medium break-words text-text-primary">{a.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                            <span className="rounded-full bg-accent-bg px-2 py-0.5 font-medium text-text-secondary">{portalAssetLabel(a.type)}</span>
                            <span>{formatLongDate(a.createdAt, zone)}</span>
                          </span>
                        </span>
                        {href && (
                          <span aria-hidden className="inline-flex min-h-10 items-center gap-1.5 rounded-app bg-accent-bg px-3.5 text-sm font-semibold text-text-primary max-sm:w-full max-sm:justify-center">
                            Open <Icon name="external-link" size={14} />
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li key={a.id}>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-14 flex-wrap items-center gap-3 px-3.5 py-3 transition-colors hover:bg-accent-bg focus-visible:bg-accent-bg focus-visible:outline-none">
                            {row}
                          </a>
                        ) : (
                          <div className="flex min-h-14 flex-wrap items-center gap-3 px-3.5 py-3">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Progress" className="mt-7">
        <h3 className="mb-3 font-serif text-[17px] text-text-primary">Progress</h3>
        <PortalStageTrack stages={event.stages} currentPosition={event.currentStagePosition} approvalStagePosition={event.awaitingYourApproval ? event.approvalStagePosition : null} fileStages={event.fileStages} onStepClick={scrollToStep} />
      </section>

      <section aria-label="Updates" className="mt-7">
        <h3 className="mb-3 font-serif text-[17px] text-text-primary">Updates</h3>
        {event.updates.length === 0 ? (
          <p className="text-sm text-text-muted">No updates shared yet.</p>
        ) : (
          <ul className="ml-1 flex flex-col gap-4">
            {event.updates.map((u, i) => (
              <li key={i} className="relative border-l border-border pl-4">
                <span aria-hidden className={`absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "bg-ink"}`} />
                <p className="text-xs text-text-muted">
                  {formatShortDate(u.createdAt, zone)} · {u.stageName}
                </p>
                {u.note && <p className="mt-0.5 text-sm whitespace-pre-line text-text-primary">{u.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <details open={history.length <= 3} className="group mt-7" data-testid="portal-approval-history">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-app outline-none focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
            <h3 className="font-serif text-[17px] text-text-primary">
              Approval history <span className="font-sans text-xs font-medium text-text-muted">({history.length})</span>
            </h3>
            <Icon name="chevron-down" size={18} className="shrink-0 text-text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {history.map((h, i) => (
              <li key={i} className="rounded-app border border-border-light px-3.5 py-3">
                <p className="text-sm font-medium text-text-primary">
                  {h.stageName} · {approvalHistoryLabel(h)}
                </p>
                {h.decidedAt && <p className="text-xs text-text-muted">{formatShortDate(h.decidedAt, zone)}</p>}
                {h.decisionComment && <p className="mt-1.5 text-sm break-words whitespace-pre-line text-text-secondary">{h.decisionComment}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <PortalEventComments token={token} zone={zone} eventId={event.id} eventTitle={event.title} />

      <div className="mt-7 flex justify-end max-sm:[&>button]:w-full">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Phones: the comment box is far down the sheet, so a bar at the bottom keeps it (and the approval) one tap away. */}
      <div data-testid="portal-sheet-bar" className="sticky bottom-0 z-20 -mx-5 mt-4 flex gap-2 border-t border-border-light bg-card px-5 py-2.5 sm:hidden">
        <Button variant="outline" className="min-h-11 shrink-0 px-4" onClick={goToComment}>
          <Icon name="message" size={15} /> Comment
        </Button>
        {pending && !thanks && (
          <Button className="min-h-11 flex-1 text-[14px] whitespace-nowrap" onClick={goToApproval}>
            <Icon name="shield" size={15} /> Review and approve
          </Button>
        )}
      </div>
    </div>
  );
}
