"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

/**
 * A secret link shown ONCE, right after it's made (client portal link,
 * calendar subscribe link): the warning, the address, a Copy button and any
 * extra actions. Shared so the copy handling and the warning stay the same
 * everywhere such a link is handed out. `onCopied` lets the caller know the
 * link is safe to hide.
 */
export function OneTimeLink({
  url,
  note,
  testId,
  copyLabel = "Copy",
  onCopied,
  actions,
  children,
  className = "",
}: {
  url: string;
  note: ReactNode;
  testId?: string;
  copyLabel?: string;
  onCopied?: () => void;
  /** Extra buttons or links next to Copy. */
  actions?: ReactNode;
  /** Shown under the buttons (hints). */
  children?: ReactNode;
  className?: string;
}) {
  const { showToast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied.", "success");
      onCopied?.();
    } catch {
      showToast("Could not copy. Select the link and copy it by hand.", "error");
    }
  }

  return (
    <div className={`animate-rise rounded-app-lg border border-primary/25 bg-primary-bg p-4 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <Icon name="lock" size={13} /> {note}
      </p>
      <p data-testid={testId} className="mt-2 rounded-app bg-card p-2.5 text-sm break-all text-text-primary ring-1 ring-border ring-inset">
        {url}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Button variant="outline" onClick={copy}>
          <Icon name="copy" size={16} /> {copyLabel}
        </Button>
        {actions}
      </div>
      {children}
    </div>
  );
}
