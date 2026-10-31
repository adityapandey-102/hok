"use client";

import { Button } from "../../../components/ui/Button";
import { CountUp } from "../../../components/ui/CountUp";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { initialsOf } from "../lib/reportFormat";

/**
 * The pieces every Reports tab is built from, so they read as one page: a
 * section heading, a board of headline figures, the loading and error states,
 * and the initials avatar.
 */

export function SectionIntro({ id, title, description, action }: { id: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="font-serif text-xl leading-tight text-text-primary sm:text-[22px]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export type FigureTone = "default" | "success" | "warning" | "error";

const VALUE_TONE: Record<FigureTone, string> = {
  default: "text-text-primary",
  success: "text-success",
  warning: "text-warning-text",
  error: "text-error",
};
const DOT_TONE: Record<FigureTone, string> = {
  default: "bg-accent-light",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

export interface Figure {
  key: string;
  icon: IconName;
  label: string;
  /** A count (animated) or ready-formatted text such as "4.5 days". */
  value: number | string;
  caption?: string;
  tone?: FigureTone;
}

/** Headline figures. `columns` is the grid's classes, chosen by the caller so every row is full. */
export function FigureBoard({ label, figures, columns }: { label: string; figures: Figure[]; columns: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-app-lg bg-card shadow-app">
      <div className={`stagger-in grid gap-px bg-border-light ${columns}`}>
        {figures.map((f) => {
          const tone = f.tone ?? "default";
          return (
            <div key={f.key} className="flex min-w-0 flex-col bg-card px-4 pt-4 pb-3.5 sm:px-5 sm:pt-5 sm:pb-4">
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-text-secondary">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-app-sm bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
                  <Icon name={f.icon} size={14} />
                </span>
                <span className="min-w-0 truncate">{f.label}</span>
              </span>
              <span className={`figure mt-2.5 block truncate text-[24px] leading-none sm:text-[28px] ${VALUE_TONE[tone]}`}>
                {typeof f.value === "number" ? <CountUp to={f.value} /> : f.value}
              </span>
              {f.caption && (
                <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`} />
                  <span className="min-w-0 truncate">{f.caption}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SkeletonRows({ rows, className = "h-14" }: { rows: number; className?: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`skeleton rounded-app-sm ${className}`} />
      ))}
    </div>
  );
}

/** A figure board's shape while loading, so the page doesn't jump when the numbers land. */
export function SkeletonBoard({ cells, columns }: { cells: number; columns: string }) {
  return (
    <div className="overflow-hidden rounded-app-lg bg-card shadow-app" aria-hidden>
      <div className={`grid gap-px bg-border-light ${columns}`}>
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className="bg-card px-5 pt-5 pb-4">
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="skeleton mt-3 h-7 w-16 rounded" />
            <div className="skeleton mt-2.5 h-3 w-28 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Couldn't load ..." with the reason and a Try again button, never a blank panel. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-app-lg border border-error/25 bg-error-bg/30 px-5 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-bg text-error">
        <Icon name="alert" size={18} />
      </span>
      <p className="mt-3 font-semibold text-text-primary">{title}</p>
      <p className="mt-1 max-w-md text-sm text-text-muted">{message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        <Icon name="refresh" size={15} /> Try again
      </Button>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span role="status" aria-label={label} className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />;
}

/** Initials in a ring: green while Working, plain otherwise. */
export function Avatar({ name, working = false, size = "md" }: { name: string; working?: boolean; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ${size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs"} ${
        working ? "bg-accent-bg text-text-primary ring-success" : "bg-accent-bg text-text-muted ring-border"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}
