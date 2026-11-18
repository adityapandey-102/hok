"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiErrorCode } from "../../../lib/api/client";
import { portalApi, type PortalLink } from "../api/portalApi";
import { linkState, whatsappShareUrl } from "../lib/share";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Panel } from "../../../components/ui/Panel";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

/**
 * Client workspace Portal tab. Since round 5 the API returns the active link's
 * URL every time (stored in plain text, decision 2026-11-18), so staff can copy
 * it again at any time. A new link switches the old one off at once.
 */
export function PortalTab({
  clientId,
  archived,
  viewerTimeZone,
  canManage = true,
  leadName,
}: {
  clientId: string;
  archived: boolean;
  viewerTimeZone: string;
  /** The client's lead (or the Admin) makes and turns off the link; other team members only see it. */
  canManage?: boolean;
  leadName?: string;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [link, setLink] = useState<PortalLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Copied" for 2 s; or, when the clipboard refuses, the hint to copy by hand.
  const [copyNote, setCopyNote] = useState<"copied" | "manual" | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    portalApi
      .get(clientId)
      .then((d) => {
        setLink(d.link);
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load the portal link",
        ),
      )
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copy(text: string) {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote("copied");
      copyTimer.current = setTimeout(() => setCopyNote(null), 2000);
    } catch {
      // No clipboard (an old browser or a blocked permission): select the link so Ctrl+C works.
      const el = urlRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopyNote("manual");
    }
  }

  const state = linkState(link);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: viewerTimeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  async function generate() {
    const regenerate = state === "active";
    const ok = await confirm({
      title: regenerate ? "Make a new link?" : "Generate a portal link?",
      body: regenerate
        ? "The current link will stop working immediately. Make a new one?"
        : "Anyone with the link can see this client portal.",
      confirmLabel: regenerate ? "Make a new link" : "Generate",
      danger: regenerate,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await portalApi.generate(clientId);
      setLink(res.link);
      setCopyNote(null);
    } catch (err) {
      if (isApiErrorCode(err, "CLIENT_ARCHIVED"))
        showToast("This client is archived. Unarchive it first.", "error");
      else
        showToast(
          err instanceof Error ? err.message : "Failed to generate the link",
          "error",
        );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    const ok = await confirm({
      title: "Switch off the portal link?",
      body: "The client can no longer open their portal until you generate a new link.",
      confirmLabel: "Switch off",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await portalApi.disable(clientId);
      setLink(res.link);
      setCopyNote(null);
      showToast("Portal link switched off.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to switch off the link",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="max-w-2xl space-y-3" aria-busy="true" aria-label="Loading the portal link">
        <div className="skeleton h-14 rounded-app-lg" />
        <div className="skeleton h-28 rounded-app-lg" />
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
        <span>{error}</span>
        <button onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );

  return (
    <Panel
      className="max-w-2xl"
      icon="share"
      title="Client portal link"
      subtitle="A private page where the client follows their events and writes to you"
      action={
        <StatusPill
          label={state === "active" ? "Active" : state === "disabled" ? "Switched off" : "No link"}
          tone={state === "active" ? "green" : state === "disabled" ? "red" : "gray"}
        />
      }
    >
      <div className="p-5">
        {archived && (
          <p className="mb-3 rounded-app bg-warning-bg p-3 text-sm text-warning-text">
            This client is archived, so archiving switched the portal link off. Unarchive the client first, then generate a new link.
          </p>
        )}

        {link ? (
          <dl className="grid grid-cols-1 gap-3 rounded-app-lg bg-accent-bg p-4 text-sm ring-1 ring-border-light ring-inset sm:grid-cols-3">
            <div>
              <dt className="text-xs text-text-muted">Created</dt>
              <dd className="text-text-primary">
                {fmt(link.createdAt)}
                {link.createdByName ? ` by ${link.createdByName}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">{link.revokedAt ? "Switched off" : "Last opened"}</dt>
              <dd className="text-text-primary">{link.revokedAt ? fmt(link.revokedAt) : link.lastUsedAt ? fmt(link.lastUsedAt) : "Never opened"}</dd>
            </div>
            {link.revokedAt && (
              <div>
                <dt className="text-xs text-text-muted">Last opened</dt>
                <dd className="text-text-primary">{link.lastUsedAt ? fmt(link.lastUsedAt) : "Never opened"}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="rounded-app-lg bg-accent-bg p-4 text-sm text-text-muted ring-1 ring-border-light ring-inset">No link yet. Generate one to share the portal with this client.</p>
        )}

        {state === "active" && link?.url && (
          <div className="mt-4 rounded-app-lg border border-primary/25 bg-primary-bg p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Icon name="lock" size={13} /> Anyone with this link can open the portal. Share it only with the client.
            </p>
            <p ref={urlRef} data-testid="portal-url" className="mt-2 rounded-app bg-card p-2.5 text-sm break-all text-text-primary ring-1 ring-border ring-inset select-all">
              {link.url}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button variant="outline" onClick={() => void copy(link.url!)}>
                <Icon name={copyNote === "copied" ? "check" : "copy"} size={16} /> {copyNote === "copied" ? "Copied" : "Copy"}
              </Button>
              <ButtonLink variant="outline" href={link.url} target="_blank" rel="noopener noreferrer">
                <Icon name="external-link" size={16} /> Open
              </ButtonLink>
              <ButtonLink variant="outline" href={whatsappShareUrl(link.url)} target="_blank" rel="noopener noreferrer">
                <Icon name="send" size={16} /> Share on WhatsApp
              </ButtonLink>
            </div>
            <p role="status" aria-live="polite" className={`mt-2 text-xs text-text-muted ${copyNote === "manual" ? "" : "sr-only"}`}>
              {copyNote === "manual" ? "Press Ctrl+C to copy the selected link." : copyNote === "copied" ? "Link copied." : ""}
            </p>
          </div>
        )}

        {state === "active" && link && !link.url && (
          <p data-testid="portal-no-url" className="mt-4 rounded-app-lg bg-warning-bg p-3.5 text-sm text-warning-text">
            This link was made before links could be copied again. Make a new link to get one you can copy any time.
          </p>
        )}

        {!archived && !canManage && (
          <p className="mt-4 text-sm text-text-muted">Only the client&apos;s lead{leadName ? ` (${leadName})` : ""} or the Admin can change the portal link.</p>
        )}

        {!archived && canManage && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button variant={state === "active" ? "outline" : "primary"} disabled={busy} onClick={generate}>
              <Icon name={state === "active" ? "refresh" : "plus"} size={16} /> {state === "active" ? "Make a new link" : "Generate link"}
            </Button>
            {state === "active" && (
              <Button variant="outline" disabled={busy} onClick={disable}>
                Switch off
              </Button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
