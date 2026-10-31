"use client";

import { useEffect, useId, useState } from "react";
import { ASSET_TAGS_MAX, ASSET_TAG_MAX_LENGTH, normalizeTags, type TagSuggestion } from "../../../lib/domain";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { assetsApi } from "../api/assetsApi";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";

/**
 * Free-form tags as chips (FR-AST-02/03). Type and press Enter or comma to add;
 * the client's existing tags are suggested as you type (debounced, fetched from
 * the server). Matching is case-insensitive, so "reels" reuses "Reels".
 */
export function TagInput({
  id,
  value,
  onChange,
  clientId,
  disabled,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Suggestions come from this client's tags; without it, from every tag in the viewer's scope. */
  clientId?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const listId = useId();
  const full = value.length >= ASSET_TAGS_MAX;

  useEffect(() => {
    if (full) return;
    let cancelled = false;
    assetsApi
      .tags({ clientId, q: debounced || undefined, limit: 8 })
      .then((data) => {
        if (!cancelled) setSuggestions(data.tags);
      })
      .catch(() => {
        // Suggestions are a convenience; typing a tag still works without them.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, debounced, full]);

  function add(raw: string) {
    const next = normalizeTags([...value, ...raw.split(",")]).map((t) => t.slice(0, ASSET_TAG_MAX_LENGTH));
    onChange(next.slice(0, ASSET_TAGS_MAX));
    setText("");
  }

  const taken = new Set(value.map((t) => t.toLowerCase()));
  const shown = suggestions.filter((s) => !taken.has(s.name.toLowerCase()));

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-app-sm bg-accent-bg px-2 py-0.5 text-xs font-medium text-text-secondary">
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded-full p-0.5 hover:bg-accent-light"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={text}
        disabled={disabled || full}
        maxLength={ASSET_TAG_MAX_LENGTH}
        placeholder={full ? `Up to ${ASSET_TAGS_MAX} tags` : "Add a tag and press Enter"}
        aria-describedby={listId}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim()) add(text);
          } else if (e.key === "Backspace" && !text && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (text.trim()) add(text);
        }}
      />
      <div id={listId} className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested tags">
        {!full &&
          shown.map((s) => (
            <button
              key={s.name}
              type="button"
              // mousedown so the suggestion is taken before the input's blur fires.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s.name)}
              className="rounded-app-sm border border-border bg-card px-2 py-0.5 text-xs text-text-secondary hover:bg-accent-bg"
            >
              + {s.name}
            </button>
          ))}
      </div>
    </div>
  );
}
