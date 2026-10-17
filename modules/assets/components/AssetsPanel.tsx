"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  dayStartIso,
  nextDay,
  type Asset,
  type AssetType,
  type TagSuggestion,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { assetsApi } from "../api/assetsApi";
import { eventsApi } from "../../events/api/eventsApi";
import { Button } from "../../../components/ui/Button";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { AssetFormModal } from "./AssetFormModal";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Panel } from "../../../components/ui/Panel";

const PAGE_SIZE = 20;
const TYPE_TONES: Record<AssetType, PillTone> = { photo: "blue", video: "green", document: "gray", design: "amber", audio: "pink", other: "gray" };
const TYPE_ICONS: Record<AssetType, IconName> = { photo: "image", video: "eye", document: "file", design: "palette", audio: "bell", other: "external-link" };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The asset link library (FR-AST-01..06): a server-paged, searchable list of
 * links with type, comment, tags and linked event. With a `clientId` it is the
 * client workspace's Assets tab; without, it spans every client the viewer
 * can see (/app/assets) and shows the client on each row. Links open in a new
 * tab; "copy link" puts the URL on the clipboard.
 */
export function AssetsPanel({
  clientId,
  readOnly = false,
  viewerTimeZone,
}: {
  clientId?: string;
  readOnly?: boolean;
  viewerTimeZone: string;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [type, setType] = useState<AssetType | "">("");
  const [tag, setTag] = useState("");
  const [eventId, setEventId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tagOptions, setTagOptions] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<{ asset?: Asset } | null>(null);

  // Filter choices: this scope's tags, refreshed after any change. (The event filter searches the API as you type.)
  useEffect(() => {
    let cancelled = false;
    assetsApi
      .tags({ clientId, limit: 50 })
      .then((d) => {
        if (!cancelled) setTagOptions(d.tags);
      })
      .catch(() => {
        // Filter choices are a convenience.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      assetsApi
        .list({
          clientId,
          search: debouncedSearch || undefined,
          type: type || undefined,
          tag: tag || undefined,
          eventId: eventId || undefined,
          from: fromDate ? (dayStartIso(fromDate, viewerTimeZone) ?? undefined) : undefined,
          to: toDate ? (dayStartIso(nextDay(toDate), viewerTimeZone) ?? undefined) : undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })
        .then((data) => {
          if (cancelled) return;
          setAssets(data.assets);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load assets");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [clientId, debouncedSearch, type, tag, eventId, fromDate, toDate, viewerTimeZone, page, reloadKey]);

  const filtered = !!(search.trim() || type || tag || eventId || fromDate || toDate);

  async function copyLink(a: Asset) {
    try {
      await navigator.clipboard.writeText(a.url);
      showToast("Link copied.", "success");
    } catch {
      showToast("Could not copy. Select the link and copy it by hand.", "error");
    }
  }

  async function remove(a: Asset) {
    const ok = await confirm({
      title: `Delete "${a.title}"?`,
      body: "The link is removed from the library. The file it points to is not touched.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await assetsApi.remove(a.id, a.version);
      showToast("Asset deleted.", "success");
      // Deleting the last row of a page would leave an empty page.
      if (assets.length === 1 && page > 0) setPage(page - 1);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (isApiErrorCode(err, "ASSET_MODIFIED")) {
        showToast("Someone else changed this asset. The list was refreshed.", "error");
        setReloadKey((k) => k + 1);
      } else if (isApiErrorCode(err, "ASSET_NOT_FOUND")) {
        setReloadKey((k) => k + 1);
      } else {
        showToast(err instanceof Error ? err.message : "Failed to delete the asset", "error");
      }
    }
  }

  const resetPage = () => setPage(0);

  return (
    <Panel
      icon="image"
      title="Asset links"
      subtitle={loading || error ? "Links only, files stay in Drive and friends" : `${total.toLocaleString("en-IN")} ${total === 1 ? "link" : "links"}, newest first`}
      action={
        !readOnly ? (
          <Button className="max-sm:hidden" onClick={() => setForm({})}>
            <Icon name="plus" size={16} /> Add asset
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 border-y border-border-light bg-accent-bg/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <Input
          className="sm:max-w-xs sm:flex-1"
          placeholder="Search title, comment or tag"
          aria-label="Search assets"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select className="sm:w-auto" aria-label="Filter by type" value={type} onChange={(e) => { setType(e.target.value as AssetType | ""); resetPage(); }}>
            <option value="">All types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select className="sm:w-auto" aria-label="Filter by tag" value={tag} onChange={(e) => { setTag(e.target.value); resetPage(); }}>
            <option value="">All tags</option>
            {tagOptions.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.uses})
              </option>
            ))}
          </Select>
        </div>
        {clientId && (
          <SearchSelect
            className="sm:w-56"
            aria-label="Filter by event"
            placeholder="All events"
            value={eventId || null}
            clearable
            loadKey={clientId}
            load={(q) => eventsApi.searchOptions(clientId, q)}
            onChange={(id) => {
              setEventId(id ?? "");
              resetPage();
            }}
          />
        )}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-text-muted sm:flex-row sm:items-center sm:gap-1.5">
            Added from
            <Input type="date" className="sm:w-auto" aria-label="Added from" value={fromDate} onChange={(e) => { setFromDate(e.target.value); resetPage(); }} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-text-muted sm:flex-row sm:items-center sm:gap-1.5">
            to
            <Input type="date" className="sm:w-auto" aria-label="Added to" value={toDate} onChange={(e) => { setToDate(e.target.value); resetPage(); }} />
          </label>
        </div>
        {!readOnly && (
          <Button className="sm:hidden" onClick={() => setForm({})}>
            <Icon name="plus" size={16} /> Add asset
          </Button>
        )}
      </div>

      {loading ? (
        <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading assets">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <div className="skeleton h-10 w-10 shrink-0 rounded-app" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/5 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
                <div className="skeleton h-3 w-3/5 rounded" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
          <span>{error}</span>
          <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon="image"
          title={filtered ? "No assets match these filters." : readOnly ? "No assets." : "No asset links yet."}
          description={filtered || readOnly ? undefined : "Add the first one."}
        />
      ) : (
        <ul className="divide-y divide-border-light">
          {assets.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-accent-bg sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <div className="flex min-w-0 flex-1 gap-3">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
                  <Icon name={TYPE_ICONS[a.type]} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold break-words text-text-primary underline-offset-2 hover:text-primary hover:underline"
                    >
                      {a.title}
                    </a>
                    <StatusPill label={ASSET_TYPE_LABELS[a.type]} tone={TYPE_TONES[a.type]} />
                  </div>
                  <p className="mt-0.5 text-xs break-all text-text-muted">{hostOf(a.url)}</p>
                  {a.comment && <p className="mt-1 text-sm break-words whitespace-pre-wrap text-text-secondary">{a.comment}</p>}
                  {a.tags.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
                      {a.tags.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => {
                              setTag(t);
                              resetPage();
                            }}
                            className="rounded-app-sm bg-accent-bg px-2 py-0.5 text-xs font-medium text-text-secondary ring-1 ring-border ring-inset transition-colors hover:bg-accent-light hover:text-text-primary"
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-text-muted">
                    {[
                      a.eventTitle ? `Event: ${a.eventTitle}` : null,
                      a.createdByName ? `Added by ${a.createdByName}` : null,
                      new Intl.DateTimeFormat("en-GB", { timeZone: viewerTimeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(a.createdAt)),
                    ]
                      .filter((x): x is string => typeof x === "string")
                      .join(" · ")}
                  </p>
                  {!clientId && (
                    <p className="mt-0.5 text-xs">
                      <Link href={`/app/clients/${a.clientId}`} className="font-medium text-primary hover:underline">
                        {a.clientName}
                      </Link>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5 max-sm:pl-[52px]">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${a.title} in a new tab`}
                  className="inline-flex items-center justify-center rounded-app border border-border bg-card p-2.5 text-text-primary transition-colors hover:bg-accent-bg sm:p-2"
                >
                  <Icon name="external-link" size={16} />
                </a>
                <Button variant="outline" className="p-2.5 sm:p-2" aria-label={`Copy link to ${a.title}`} onClick={() => copyLink(a)}>
                  <Icon name="copy" size={16} />
                </Button>
                {!readOnly && a.clientStatus !== "archived" && (
                  <>
                    <Button variant="outline" className="p-2.5 sm:p-2" aria-label={`Edit ${a.title}`} onClick={() => setForm({ asset: a })}>
                      <Icon name="edit" size={16} />
                    </Button>
                    <Button variant="outline" className="p-2.5 sm:p-2" aria-label={`Delete ${a.title}`} onClick={() => remove(a)}>
                      <Icon name="trash" size={16} />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}

      {form && (
        <AssetFormModal
          asset={form.asset}
          clientId={clientId}
          onClose={() => setForm(null)}
          onSaved={(_saved, created) => {
            setForm(null);
            showToast(created ? "Asset added." : "Asset saved.", "success");
            if (created) setPage(0);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </Panel>
  );
}
