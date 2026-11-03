"use client";

import { useEffect, useState } from "react";
import { ROLES, ROLE_LABELS, templateRolesLabel, type Role, type StageTemplate, type TemplateKind } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { templatesApi } from "../api/templatesApi";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Pager } from "../../../components/ui/Pager";
import { Segmented } from "../../../components/ui/Segmented";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";

const PAGE_SIZE = 20;
const MAX_STAGES = 20;
/** Task templates can be offered for any role except the Admin (the Admin assigns, never receives). */
const TASK_ROLES = ROLES.filter((r) => r !== "admin");

const KIND_OPTIONS: { id: TemplateKind; label: string }[] = [
  { id: "event", label: "Events" },
  { id: "task", label: "Tasks" },
];
const KIND_NOUN: Record<TemplateKind, string> = { event: "event", task: "task" };

/**
 * Admin: stage templates (FR-EVT-01/02, round 2). A template is an ordered list of
 * stage names that an event (or a staff task) copies when it is created. The
 * Events | Tasks switch picks which kind the list and "New template" are about;
 * a task template can be limited to some assignee roles.
 */
export function TemplatesClient() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<TemplateKind>("event");
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
        .list({ kind, search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
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
  }, [kind, debouncedSearch, page, reloadKey]);

  async function toggleActive(t: StageTemplate) {
    if (t.active) {
      const ok = await confirm({
        title: `Deactivate ${t.name}?`,
        body: `No new ${KIND_NOUN[t.kind]}s can use it. ${t.kind === "task" ? "Tasks" : "Events"} already created keep their own stages.`,
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
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Stage templates</h1>
          <p className="text-sm text-text-muted">
            {kind === "event"
              ? "The stages an event moves through. Managers pick one when they create an event."
              : "The stages a staff task moves through. Managers pick one when they assign a task."}
          </p>
        </div>
        {!editing && (
          <div className="page-actions">
            <Button onClick={() => setEditing("new")}>
              <Icon name="plus" size={16} /> New template
            </Button>
          </div>
        )}
      </header>

      <Segmented
        label="Template kind"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setEditing(null);
          setPage(0);
        }}
        className="mb-4 self-start max-sm:w-full"
        stretch
      />

      {editing && (
        <TemplateEditor
          key={editing === "new" ? "new-" + kind : editing.id + editing.version}
          template={editing === "new" ? null : editing}
          kind={kind}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <div className="relative mb-4 sm:max-w-sm">
        <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
        <Input
          className="pl-9"
          aria-label="Search templates"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-app-lg bg-card shadow-app">
        {loading ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading templates">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="space-y-2.5 px-5 py-4">
                <div className="skeleton h-4 w-40 rounded-app-sm" />
                <div className="skeleton h-5 w-3/4 rounded-app-sm" />
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
        ) : templates.length === 0 ? (
          <EmptyState icon="layers" title={search.trim() ? "No templates match your search." : `No ${KIND_NOUN[kind]} templates yet.`} description={search.trim() ? undefined : `Create a template to give ${KIND_NOUN[kind]}s their stages.`} />
        ) : (
          <ul className="divide-y divide-border-light">
            {templates.map((t) => (
              <li key={t.id} className={`flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent-bg lg:flex-row lg:items-center lg:gap-4 ${t.active ? "" : "opacity-75"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-[16px] text-text-primary">{t.name}</span>
                    <StatusPill label={t.active ? "Active" : "Inactive"} tone={t.active ? "green" : "gray"} />
                    <span className="text-xs text-text-muted">{t.stages.length} stages</span>
                    {t.kind === "task" && <span className="text-xs text-text-muted">· For: {templateRolesLabel(t.roles)}</span>}
                  </div>
                  <ol className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label={`${t.name} stages`}>
                    {t.stages.map((s, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-bg px-2.5 py-1 text-xs text-text-secondary ring-1 ring-border ring-inset">
                          <span className="figure text-[10.5px] text-text-muted">{i + 1}</span>
                          {s.name}
                        </span>
                        {i < t.stages.length - 1 && <Icon name="chevron-right" size={12} className="text-border" />}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="px-3 py-1.5 text-xs max-sm:flex-1" onClick={() => setEditing(t)}>
                    <Icon name="edit" size={13} /> Edit
                  </Button>
                  <Button variant="outline" className="px-3 py-1.5 text-xs max-sm:flex-1" onClick={() => toggleActive(t)}>
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
  kind: newKind,
  onCancel,
  onSaved,
}: {
  template: StageTemplate | null;
  /** The kind a NEW template gets (the list's switch); an existing one keeps its own. */
  kind: TemplateKind;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [stages, setStages] = useState<string[]>(template?.stages.map((s) => s.name) ?? ["Planned", "Completed"]);
  const [roles, setRoles] = useState<Role[]>(template?.roles ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = template?.kind ?? newKind;

  const toggleRole = (r: Role) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
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
        await templatesApi.update(template.id, { name: name.trim(), stages: cleaned, ...(kind === "task" ? { roles } : {}), version: template.version });
      } else {
        await templatesApi.create({ name: name.trim(), stages: cleaned, kind, ...(kind === "task" ? { roles } : {}) });
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
    <form onSubmit={handleSubmit} className="animate-rise mb-6 rounded-app-lg border border-border bg-card p-5 shadow-app-md sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-serif text-lg text-text-primary">
        <span className="flex h-9 w-9 items-center justify-center rounded-app bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
          <Icon name="layers" size={17} />
        </span>
        {template ? `Edit ${template.name}` : `New ${KIND_NOUN[kind]} template`}
        <StatusPill label={kind === "task" ? "Task template" : "Event template"} tone="gray" />
      </h2>
      <div className="max-w-md">
        <FieldLabel required htmlFor="tpl-name">
          Template name
        </FieldLabel>
        <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>

      {kind === "task" && (
        <fieldset className="mt-4">
          <legend className="mb-1 text-xs font-medium text-text-secondary">For roles</legend>
          <p className="mb-2 text-xs text-text-muted">Empty = any role.</p>
          <div className="flex flex-wrap gap-2">
            {TASK_ROLES.map((r) => (
              <label
                key={r}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/25 px-3.5 py-1.5 text-sm ring-1 ring-inset transition-colors ${
                  roles.includes(r) ? "bg-ink text-on-ink ring-ink" : "bg-accent-bg text-text-secondary ring-border hover:bg-accent-light/70"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-text-secondary">Stages, in order (a{kind === "task" ? " task" : "n event"} starts at the first one)</legend>
        <ol className="flex flex-col gap-2">
          {stages.map((stage, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="figure flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-bg text-[11px] text-text-secondary ring-1 ring-border ring-inset">{i + 1}</span>
              <Input className="min-w-0" aria-label={`Stage ${i + 1} name`} value={stage} maxLength={60} onChange={(e) => setStage(i, e.target.value)} />
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
