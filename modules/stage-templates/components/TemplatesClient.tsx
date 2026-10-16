"use client";

import { useEffect, useState } from "react";
import type { StageTemplate } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { templatesApi } from "../api/templatesApi";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

const PAGE_SIZE = 20;
const MAX_STAGES = 20;

/** Admin: stage templates (FR-EVT-01/02). A template is an ordered list of stage names that an event copies when it is created. */
export function TemplatesClient() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // null = closed, "new" = creating, otherwise the template being edited.
  const [editing, setEditing] = useState<StageTemplate | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      templatesApi
        .list({ search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setTemplates(data.templates);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load templates");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, reloadKey]);

  async function toggleActive(t: StageTemplate) {
    if (t.active) {
      const ok = await confirm({
        title: `Deactivate ${t.name}?`,
        body: "No new events can use it. Events already created keep their own stages.",
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await templatesApi.update(t.id, { active: !t.active, version: t.version });
      showToast(t.active ? "Template deactivated." : "Template reactivated.", "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(isApiErrorCode(err, "STAGE_TEMPLATE_MODIFIED") ? "Someone else changed this template. Reloaded." : err instanceof Error ? err.message : "Failed", "error");
      setReloadKey((k) => k + 1);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Stage templates</h1>
          <p className="text-sm text-text-muted">The stages an event moves through. Managers pick one when they create an event.</p>
        </div>
        {!editing && (
          <Button className="max-sm:w-full" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} /> New template
          </Button>
        )}
      </div>

      {editing && (
        <TemplateEditor
          key={editing === "new" ? "new" : editing.id + editing.version}
          template={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <div className="mb-3">
        <Input
          className="max-w-sm"
          aria-label="Search templates"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
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
        ) : templates.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">{search.trim() ? "No templates match your search." : "No templates yet."}</div>
        ) : (
          <ul className="divide-y divide-border-light">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">{t.name}</span>
                    <StatusPill label={t.active ? "Active" : "Inactive"} tone={t.active ? "green" : "gray"} />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{t.stages.map((s) => s.name).join(" → ")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => toggleActive(t)}>
                    {t.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  onCancel,
  onSaved,
}: {
  template: StageTemplate | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [stages, setStages] = useState<string[]>(template?.stages.map((s) => s.name) ?? ["Planned", "Completed"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStage = (i: number, value: string) => setStages((s) => s.map((x, j) => (j === i ? value : x)));
  const move = (i: number, delta: number) =>
    setStages((s) => {
      const j = i + delta;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = stages.map((s) => s.trim());
    if (!name.trim()) return setError("Please enter a template name.");
    if (cleaned.length === 0 || cleaned.some((s) => !s)) return setError("Every stage needs a name.");
    if (new Set(cleaned.map((s) => s.toLowerCase())).size !== cleaned.length) return setError("Stage names can not repeat.");
    setSaving(true);
    try {
      if (template) {
        await templatesApi.update(template.id, { name: name.trim(), stages: cleaned, version: template.version });
      } else {
        await templatesApi.create({ name: name.trim(), stages: cleaned });
      }
      showToast("Template saved.", "success");
      onSaved();
    } catch (err) {
      if (isApiErrorCode(err, "STAGE_TEMPLATE_NAME_TAKEN")) setError("A template with this name already exists.");
      else if (isApiErrorCode(err, "STAGE_TEMPLATE_MODIFIED")) setError("Someone else changed this template. Cancel and reopen it to see the latest version.");
      else setError(err instanceof Error ? err.message : "Failed to save the template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-app-lg border border-border bg-card p-5 shadow-app">
      <h2 className="mb-3 font-serif text-lg font-bold text-text-primary">{template ? `Edit ${template.name}` : "New template"}</h2>
      <div className="max-w-md">
        <FieldLabel required htmlFor="tpl-name">
          Template name
        </FieldLabel>
        <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-text-secondary">Stages, in order (an event starts at the first one)</legend>
        <ol className="flex flex-col gap-2">
          {stages.map((stage, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs text-text-muted">{i + 1}.</span>
              <Input aria-label={`Stage ${i + 1} name`} value={stage} maxLength={60} onChange={(e) => setStage(i, e.target.value)} />
              <Button type="button" variant="outline" className="px-2.5 py-2" aria-label={`Move stage ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="chevron-right" size={14} className="-rotate-90" />
              </Button>
              <Button type="button" variant="outline" className="px-2.5 py-2" aria-label={`Move stage ${i + 1} down`} disabled={i === stages.length - 1} onClick={() => move(i, 1)}>
                <Icon name="chevron-right" size={14} className="rotate-90" />
              </Button>
              <Button type="button" variant="ghost" className="px-2.5 py-2" aria-label={`Remove stage ${i + 1}`} disabled={stages.length === 1} onClick={() => setStages((s) => s.filter((_, j) => j !== i))}>
                <Icon name="x" size={14} />
              </Button>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" className="mt-3" disabled={stages.length >= MAX_STAGES} onClick={() => setStages((s) => [...s, ""])}>
          <Icon name="plus" size={14} /> Add stage
        </Button>
      </fieldset>

      <FieldError>{error}</FieldError>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : template ? "Save template" : "Create template"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
