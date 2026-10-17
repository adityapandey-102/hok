"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../lib/api/options";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../lib/hooks/useDebouncedValue";
import { clampActive, moveActive } from "./searchSelectHelpers";
import { Icon } from "./Icon";

export interface SearchSelectProps<T = unknown> {
  /** The chosen id, or null for "nothing / all". */
  value: string | null;
  /** Label of `value`, so an edit form can show its current choice without a fetch. */
  selectedLabel?: string;
  onChange: (id: string | null, item?: SelectOption<T>) => void;
  /** Asks the API (search + limit 20 + offset 0). Called with "" on open to show the first 20. */
  load: (search: string) => Promise<SelectOption<T>[]>;
  /** Change this when `load` means something else now (e.g. another client), so the list refetches. */
  loadKey?: string;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  clearable?: boolean;
  emptyText?: string;
  className?: string;
  /** Ids to hide from the list (a multi-select's already chosen rows). */
  excludeIds?: string[];
  /** Multi-select mode: picking a row calls onChange but the box stays empty and ready for the next one. */
  clearOnSelect?: boolean;
}

interface Result<T> {
  key: string;
  items?: SelectOption<T>[];
  error?: string;
}

/**
 * Async combobox: every search is a server call (debounced, at most 20 rows),
 * never a browser-side filter over a preloaded list. Opening it with nothing
 * typed shows the first 20. Keyboard: arrows, Enter, Escape.
 */
export function SearchSelect<T = unknown>({
  value,
  selectedLabel,
  onChange,
  load,
  loadKey = "",
  placeholder = "Search…",
  id,
  "aria-label": ariaLabel,
  disabled = false,
  clearable = false,
  emptyText = "No matches",
  className = "",
  excludeIds,
  clearOnSelect = false,
}: SearchSelectProps<T>) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chosen, setChosen] = useState<{ id: string; label: string } | null>(null);
  const [result, setResult] = useState<Result<T> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  // Emptying the box shows the first 20 straight away; typing waits for the pause.
  const effective = trimmed === "" ? "" : debounced;
  const key = `${openCount}|${loadKey}|${effective}|${reload}`;
  const current = result?.key === key ? result : null;
  const loading = open && (!current || effective !== trimmed);
  // While the next search runs, keep the previous rows on screen (no flicker); "Searching…" shows below them.
  const items = ((current ?? result)?.items ?? []).filter((o) => !excludeIds?.includes(o.id));
  const active = clampActive(activeIndex, items.length);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadRef
      .current(effective)
      .then((rows) => !cancelled && setResult({ key, items: rows.slice(0, SEARCH_SELECT_LIMIT) }))
      .catch((e: unknown) => !cancelled && setResult({ key, error: e instanceof Error ? e.message : "Could not load the list." }));
    return () => {
      cancelled = true;
    };
  }, [open, effective, key]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, uid]);

  const shownLabel = value ? (chosen?.id === value ? chosen.label : (selectedLabel ?? "")) : "";

  function openList() {
    if (disabled || open) return;
    setQuery("");
    setActiveIndex(0);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }

  function pick(o: SelectOption<T>) {
    setChosen(clearOnSelect ? null : { id: o.id, label: o.label });
    setOpen(false);
    setQuery("");
    onChange(o.id, o);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActiveIndex(moveActive(active, e.key === "ArrowDown" ? 1 : -1, items.length));
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        if (active >= 0 && items[active]) pick(items[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const showClear = clearable && !!value && !disabled;

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={open && shownLabel ? shownLabel : placeholder}
        value={open ? query : shownLabel}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        className={`w-full truncate rounded-app-sm border border-border bg-card py-2.5 pl-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted hover:border-accent-light focus:border-primary/60 focus:ring-3 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60 ${showClear ? "pr-14" : "pr-8"}`}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-text-muted">
        <Icon name="chevron-right" size={14} className="rotate-90" />
      </span>
      {showClear && (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => {
            setChosen(null);
            setQuery("");
            setOpen(false);
            onChange(null);
          }}
          className="absolute inset-y-0 right-7 flex items-center px-1 text-text-muted hover:text-text-primary"
        >
          <Icon name="x" size={14} />
        </button>
      )}
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-app-sm border border-border bg-card shadow-app-md">
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto">
            {items.map((o, i) => (
              <li
                key={o.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={o.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-primary-bg" : ""} ${o.id === value ? "font-semibold text-primary" : "text-text-primary"}`}
              >
                <span className="block truncate">{o.label}</span>
                {o.hint && <span className="block truncate text-xs font-normal text-text-muted">{o.hint}</span>}
              </li>
            ))}
          </ul>
          {loading && items.length === 0 && (
            <p role="status" className="px-3 py-2 text-sm text-text-muted">
              Searching…
            </p>
          )}
          {!loading && current?.error && (
            <div role="alert" className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-error">
              <span>{current.error}</span>
              <button type="button" className="font-medium underline" onMouseDown={(e) => e.preventDefault()} onClick={() => setReload((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
          {!loading && current && !current.error && items.length === 0 && <p className="px-3 py-2 text-sm text-text-muted">{emptyText}</p>}
          {loading && items.length > 0 && (
            <p role="status" className="border-t border-border-light px-3 py-1 text-xs text-text-muted">
              Searching…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
