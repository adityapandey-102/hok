"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { hasCapability, type Role } from "../../lib/domain";
import { GUIDE, searchGuide, topicFor, type GuideArticle } from "../../modules/guide/guideContent";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";

/**
 * "Guide me" (FR-HLP-01): one global, searchable guide in a modal, on every
 * staff page. It opens searching the current page's topic (e.g. "Clients");
 * clear it to search anything. Only articles the viewer's role can use.
 */
export function GuideMe({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-app px-2.5 text-sm font-medium text-text-secondary hover:bg-accent-bg hover:text-text-primary"
      >
        <Icon name="sparkles" size={16} />
        <span className="hidden sm:inline">Guide me</span>
        <span className="sr-only sm:hidden">Guide me</span>
      </button>
      {/* Remounted per opening, so it starts on the page the viewer is on. */}
      {open && <GuidePanel key={pathname} role={role} topic={topicFor(pathname)} onClose={() => setOpen(false)} />}
    </>
  );
}

function GuidePanel({ role, topic, onClose }: { role: Role; topic: string; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(topic);
  const mine = useMemo(() => GUIDE.filter((a) => !a.requires || hasCapability(role, a.requires)), [role]);
  const results = useMemo(() => searchGuide(mine, query), [mine, query]);
  const [picked, setPicked] = useState<string | null>(null);
  const article = results.find((a) => a.id === picked) ?? results[0] ?? null;

  return (
    <Modal open onClose={onClose} labelledBy="guide-title" initialFocusRef={inputRef} panelClassName="sm:max-w-4xl">
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center gap-3 border-b border-border-light px-5 py-4">
          <Icon name="sparkles" size={18} className="text-primary" />
          <h2 id="guide-title" className="font-serif text-lg text-text-primary">
            Guide
          </h2>
          <button type="button" onClick={onClose} aria-label="Close guide" className="ml-auto rounded-app p-1.5 text-text-muted hover:bg-accent-bg">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="border-b border-border-light px-5 py-3">
          <label className="flex items-center gap-2 rounded-app border border-border bg-card px-3 focus-within:border-primary/60">
            <Icon name="search" size={16} className="text-text-muted" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
              }}
              placeholder="Search features, how-tos and problems…"
              aria-label="Search the guide"
              className="h-10 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
          <ul aria-label="Guide topics" className="max-h-48 overflow-y-auto border-b border-border-light py-2 md:max-h-none md:border-r md:border-b-0">
            {results.length === 0 && <li className="px-5 py-4 text-sm text-text-muted">Nothing matches. Try another word, or clear the search.</li>}
            {results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setPicked(a.id)}
                  aria-current={a.id === article?.id}
                  className={`block w-full px-5 py-2 text-left text-sm ${a.id === article?.id ? "bg-accent-bg font-semibold text-text-primary" : "text-text-secondary hover:bg-accent-bg"}`}
                >
                  {a.title}
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0 overflow-y-auto px-5 py-5">{article && <ArticleView article={article} />}</div>
        </div>
      </div>
    </Modal>
  );
}

function ArticleView({ article: a }: { article: GuideArticle }) {
  return (
    <article className="max-w-prose">
      <h3 className="font-serif text-xl text-text-primary">{a.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{a.summary}</p>
      <h4 className="mt-5 text-sm font-semibold text-text-primary">How to</h4>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-secondary">
        {a.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {a.tips && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-text-primary">Good to know</h4>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-secondary">
            {a.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {a.problems && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-text-primary">Common problems</h4>
          <dl className="mt-2 flex flex-col gap-3 text-sm">
            {a.problems.map((p) => (
              <div key={p.q} className="rounded-app bg-accent-bg px-3 py-2">
                <dt className="font-medium text-text-primary">{p.q}</dt>
                <dd className="mt-0.5 text-text-secondary">{p.a}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </article>
  );
}
