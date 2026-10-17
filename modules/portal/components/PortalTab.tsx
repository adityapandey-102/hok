"use client";

import { useCallback, useEffect, useState } from "react";
import { isApiErrorCode } from "../../../lib/api/client";
import { portalApi, type PortalLink } from "../api/portalApi";
import { linkState, whatsappShareUrl } from "../lib/share";
import { Button } from "../../../components/ui/Button";
import { Panel } from "../../../components/ui/Panel";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

/** Client workspace Portal tab. The one-time URL lives only in component state. */
export function PortalTab({
  clientId,
  archived,
  viewerTimeZone,
}: {
  clientId: string;
  archived: boolean;
  viewerTimeZone: string;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [link, setLink] = useState<PortalLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

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
      title: regenerate
        ? "Regenerate the portal link?"
        : "Generate a portal link?",
      body: regenerate
        ? "The old link stops working straight away. Anyone using it will need the new one."
        : "Anyone with the link can see this client portal.",
      confirmLabel: regenerate ? "Regenerate" : "Generate",
      danger: regenerate,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await portalApi.generate(clientId);
      setLink(res.link);
      setUrl(res.url);
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
      title: "Disable the portal link?",
      body: "The client can no longer open their portal until you generate a new link.",
      confirmLabel: "Disable",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await portalApi.disable(clientId);
      setLink(res.link);
      setUrl(null);
      showToast("Portal link disabled.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to disable the link",
        "error",
      );
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
      showToast(
        "Could not copy. Select the link and copy it by hand.",
        "error",
      );
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
          label={state === "active" ? "Active" : state === "disabled" ? "Disabled" : "No link"}
          tone={state === "active" ? "green" : state === "disabled" ? "red" : "gray"}
        />
      }
    >
      <div className="px-5 pb-5">
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
              <dt className="text-xs text-text-muted">{link.revokedAt ? "Disabled" : "Last opened"}</dt>
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

        {url && (
          <div className="animate-rise mt-4 rounded-app-lg border border-primary/25 bg-primary-bg p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Icon name="lock" size={13} /> Copy it now. For safety the link is shown only this once.
            </p>
            <p data-testid="portal-url" className="mt-2 rounded-app bg-card p-2.5 text-sm break-all text-text-primary ring-1 ring-border ring-inset">
              {url}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button variant="outline" onClick={copy}>
                <Icon name="copy" size={16} /> Copy
              </Button>
              <a
                href={whatsappShareUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-app border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-accent-light hover:bg-accent-bg"
              >
                <Icon name="external-link" size={16} /> Share on WhatsApp
              </a>
            </div>
          </div>
        )}

        {!archived && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button disabled={busy} onClick={generate}>
              <Icon name={state === "active" ? "refresh" : "plus"} size={16} /> {state === "active" ? "Regenerate link" : "Generate link"}
            </Button>
            {state === "active" && (
              <Button variant="outline" disabled={busy} onClick={disable}>
                Disable link
              </Button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
