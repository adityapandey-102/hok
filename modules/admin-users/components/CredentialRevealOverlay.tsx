"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";

export interface RevealModal {
  name: string;
  password: string;
}

/**
 * Shown exactly once, right after a password is generated: only the hash is
 * stored server-side, so this is the only chance to copy it and hand it to the
 * account holder.
 */
export function CredentialRevealOverlay({ reveal, onClose }: { reveal: RevealModal; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context): the password is still visible to copy manually.
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Password for ${reveal.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-app-lg border border-border bg-card p-6 text-center shadow-app-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-lg font-bold text-text-primary">Password for {reveal.name}</h2>
        <p className="mt-1 text-xs text-text-muted">
          Shown once. Copy or note it down now; it cannot be shown again after you close this.
        </p>
        <div
          data-testid="revealed-password"
          className="mt-4 select-all break-all rounded-app-sm border border-border bg-app-bg/70 px-4 py-3 font-mono text-base tracking-wide text-text-primary"
        >
          {reveal.password}
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={copyPassword}>
          {copied ? (
            <>
              <Icon name="check" size={16} /> Copied
            </>
          ) : (
            <>
              <Icon name="clipboard" size={16} /> Copy password
            </>
          )}
        </Button>
        <Button className="mt-3 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
