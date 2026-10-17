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
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { AssetFormModal } from "./AssetFormModal";

const PAGE_SIZE = 20;
const TYPE_TONES: Record<AssetType, PillTone> = { photo: "pink", video: "purple", document: "blue", design: "gold", audio: "amber", other: "gray" };

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
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        <Input
          className="min-w-0 flex-1 sm:max-w-xs"
          placeholder="Search title, comment or tag"
          aria-label="Search assets"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <Select className="w-auto" aria-label="Filter by type" value={type} onChange={(e) => { setType(e.target.value as AssetType | ""); resetPage(); }}>
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select className="w-auto" aria-label="Filter by tag" value={tag} onChange={(e) => { setTag(e.target.value); resetPage(); }}>
          <option value="">All tags</option>
          {tagOptions.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.uses})
            </option>
          ))}
        </Select>
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
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Added from
          <Input type="date" className="w-auto" aria-label="Added from" value={fromDate} onChange={(e) => { setFromDate(e.target.value); resetPage(); }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          to
          <Input type="date" className="w-auto" aria-label="Added to" value={toDate} onChange={(e) => { setToDate(e.target.value); resetPage(); }} />
        </label>
        {!readOnly && (
          <Button className="max-sm:w-full sm:ml-auto" onClick={() => setForm({})}>
            <Icon name="plus" size={16} /> Add asset
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app">
        {loading ? (
          <div className="p-6 text-sm text-text-muted">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">
            {filtered ? "No assets match these filters." : readOnly ? "No assets." : "No asset links yet. Add the first one."}
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-words font-semibold text-text-primary underline-offset-2 hover:text-primary hover:underline"
                    >
                      {a.title}
                    </a>
                    <StatusPill label={ASSET_TYPE_LABELS[a.type]} tone={TYPE_TONES[a.type]} />
                  </div>
                  <p className="mt-0.5 break-all text-xs text-text-muted">{hostOf(a.url)}</p>
                  {a.comment && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">{a.comment}</p>}
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
                            className="rounded-app-sm bg-primary-bg px-2 py-0.5 text-xs font-medium text-primary hover:brightness-95"
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
                <div className="flex shrink-0 gap-1.5">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${a.title} in a new tab`}
                    className="inline-flex items-center justify-center rounded-app border border-border bg-card p-2 text-text-primary hover:border-primary/40 hover:bg-primary-bg"
                  >
                    <Icon name="external-link" size={16} />
                  </a>
                  <Button variant="outline" className="p-2" aria-label={`Copy link to ${a.title}`} onClick={() => copyLink(a)}>
                    <Icon name="copy" size={16} />
                  </Button>
                  {!readOnly && a.clientStatus !== "archived" && (
                    <>
                      <Button variant="outline" className="p-2" aria-label={`Edit ${a.title}`} onClick={() => setForm({ asset: a })}>
                        <Icon name="edit" size={16} />
                      </Button>
                      <Button variant="outline" className="p-2" aria-label={`Delete ${a.title}`} onClick={() => remove(a)}>
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
      </div>

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
    </div>
  );
}
