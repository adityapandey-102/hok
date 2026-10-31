"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../lib/hooks/useDebouncedValue";
import { Icon, type IconName } from "../ui/Icon";
import { Loader } from "../ui/Loader";

type Group = "clients" | "events" | "tasks" | "todos" | "assets";
interface Hit {
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}
interface SearchResponse {
  query: string;
  groups: Record<Group, Hit[] | null>;
}

const GROUPS: { key: Group; label: string; icon: IconName }[] = [
  { key: "clients", label: "Clients", icon: "briefcase" },
  { key: "events", label: "Events", icon: "calendar" },
  { key: "tasks", label: "Tasks", icon: "clipboard" },
  { key: "todos", label: "Client to-dos", icon: "check-circle" },
  { key: "assets", label: "Asset links", icon: "image" },
];
const MIN = 2;

/**
 * Global search (FR-SYS-01): a box in the top bar (an icon on phones), also
 * opened with Ctrl/Cmd + K. Typing is debounced; each search is one API call
 * that returns up to 5 hits per group the viewer may see. Arrow keys move,
 * Enter opens, Escape closes.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-app border border-border bg-card px-3 text-sm text-text-muted shadow-app transition-colors hover:border-accent-light hover:text-text-secondary md:flex"
      >
        <Icon name="search" size={15} />
        <span className="flex-1 truncate text-left">Search clients, events, tasks…</span>
        <kbd className="rounded-app-sm border border-border-light bg-accent-bg px-1.5 py-0.5 text-[10.5px] font-medium text-text-muted">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="inline-flex h-9 w-9 items-center justify-center rounded-app text-text-secondary hover:bg-accent-bg hover:text-text-primary md:hidden"
      >
        <Icon name="search" size={18} />
      </button>
      {open && <SearchPalette onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const term = query.trim();
  const debounced = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  const [result, setResult] = useState<{ key: string; data?: SearchResponse; error?: string } | null>(null);
  const current = result?.key === debounced ? result : null;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (debounced.length < MIN) return;
    let cancelled = false;
    apiFetch(`/search?q=${encodeURIComponent(debounced)}`)
      .then((data) => !cancelled && setResult({ key: debounced, data: data as SearchResponse }))
      .catch((e: unknown) => !cancelled && setResult({ key: debounced, error: e instanceof Error ? e.message : "Search failed." }));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Keep the previous answer on screen while the next one loads (no flicker).
  const shown = term.length >= MIN ? (current?.data ?? result?.data ?? null) : null;
  const loading = term.length >= MIN && (!current || debounced !== term);
  const sections = useMemo(
    () => (shown ? GROUPS.map((g) => ({ ...g, hits: shown.groups[g.key] ?? [] })).filter((g) => g.hits.length > 0) : []),
    [shown],
  );
  const flat = sections.flatMap((s) => s.hits);
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  function go(hit: Hit) {
    onClose();
    router.push(hit.url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActive((i) => (Math.min(i, flat.length - 1) + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length);
    } else if (e.key === "Enter" && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  }

  let index = -1;
  return (
    <div className="animate-fade-in fixed inset-0 z-[950] flex items-start justify-center bg-black/45 px-3 pt-[8vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-xl overflow-hidden rounded-app-lg border border-border bg-card shadow-app-lg"
      >
        <div className="flex items-center gap-3 border-b border-border-light px-4">
          <Icon name="search" size={18} className="text-text-muted" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={`${uid}-list`}
            aria-activedescendant={flat.length ? `${uid}-hit-${activeIndex}` : undefined}
            aria-label="Search clients, events, tasks, to-dos and asset links"
            placeholder="Search clients, events, tasks, to-dos, assets…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            maxLength={80}
            className="h-14 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
          />
          {loading && <Loader size={18} label="Searching" />}
          <kbd className="hidden rounded-app-sm border border-border-light bg-accent-bg px-1.5 py-0.5 text-[10.5px] text-text-muted sm:inline">Esc</kbd>
        </div>

        <div id={`${uid}-list`} role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto py-2">
          {term.length < MIN ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Type at least {MIN} letters: a client, an event, a task or a link.</p>
          ) : current?.error ? (
            <p role="alert" className="px-4 py-6 text-center text-sm text-error">
              {current.error}
            </p>
          ) : shown && sections.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Nothing matches “{term}”.</p>
          ) : (
            sections.map((s) => (
              <div key={s.key} className="pb-1">
                <p className="flex items-center gap-2 px-4 pt-2 pb-1 text-[11.5px] font-semibold text-text-muted">
                  <Icon name={s.icon} size={13} /> {s.label}
                </p>
                {s.hits.map((h) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      key={h.id}
                      id={`${uid}-hit-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === activeIndex ? "bg-accent-bg" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">{h.title}</span>
                        {h.subtitle && <span className="block truncate text-xs text-text-muted">{h.subtitle}</span>}
                      </span>
                      {i === activeIndex && <Icon name="chevron-right" size={14} className="shrink-0 text-text-muted" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
