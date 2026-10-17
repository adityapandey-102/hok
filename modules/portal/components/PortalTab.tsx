"use client";

import { useCallback, useEffect, useState } from "react";
import { isApiErrorCode } from "../../../lib/api/client";
import { portalApi, type PortalLink } from "../api/portalApi";
import { linkState, whatsappShareUrl } from "../lib/share";
import { Button } from "../../../components/ui/Button";
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
    return <div className="p-6 text-sm text-text-muted">Loading…</div>;
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
    <div className="max-w-2xl rounded-app-lg border border-border bg-card p-5 shadow-app">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-base font-bold text-text-primary">
          Client portal link
        </h2>
        <StatusPill
          label={
            state === "active"
              ? "Active"
              : state === "disabled"
                ? "Disabled"
                : "No link"
          }
          tone={
            state === "active" ? "green" : state === "disabled" ? "red" : "gray"
          }
        />
      </div>

      {archived && (
        <p className="mt-3 rounded-app bg-warning-bg p-3 text-sm text-warning-text">
          This client is archived, so archiving switched the portal link off.
          Unarchive the client first, then generate a new link.
        </p>
      )}

      {link ? (
        <p className="mt-3 text-sm text-text-secondary">
          Created {fmt(link.createdAt)}
          {link.createdByName ? ` by ${link.createdByName}` : ""}.{" "}
          {link.revokedAt ? `Disabled ${fmt(link.revokedAt)}. ` : ""}
          {link.lastUsedAt
            ? `Last opened ${fmt(link.lastUsedAt)}.`
            : "Never opened."}
        </p>
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          No link yet. Generate one to share the portal with this client.
        </p>
      )}

      {url && (
        <div className="mt-4 rounded-app border border-border bg-primary-bg/40 p-3">
          <p className="text-xs font-medium text-text-secondary">
            Copy it now. For safety the link is shown only this once.
          </p>
          <p
            data-testid="portal-url"
            className="mt-1 break-all text-sm text-text-primary"
          >
            {url}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy}>
              <Icon name="copy" size={16} /> Copy
            </Button>
            <a
              href={whatsappShareUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-app border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-primary hover:border-primary/40 hover:bg-primary-bg"
            >
              <Icon name="external-link" size={16} /> Share on WhatsApp
            </a>
          </div>
        </div>
      )}

      {!archived && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={generate}>
            {state === "active" ? "Regenerate link" : "Generate link"}
          </Button>
          {state === "active" && (
            <Button variant="outline" disabled={busy} onClick={disable}>
              Disable link
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
