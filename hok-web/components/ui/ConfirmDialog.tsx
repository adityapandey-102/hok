"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red). */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-styled confirmation dialog, replacing the browser's native `confirm()`
 * everywhere. Mounted once at the root layout (like ToastProvider); any client
 * component calls `const confirm = useConfirm()` then `await confirm({...})`,
 * which resolves true/false. Keyboard + overlay dismissal both count as cancel.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={options.title}
          className="animate-fade-in fixed inset-0 z-999 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm print:hidden"
          onClick={() => settle(false)}
          onKeyDown={(e) => e.key === "Escape" && settle(false)}
        >
          <div
            className="animate-scale-in card-accent-top w-full max-w-sm rounded-app-lg border border-border bg-card p-5 shadow-app-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-base font-bold text-text-primary">{options.title}</h2>
            {options.body && <p className="mt-2 text-sm text-text-secondary">{options.body}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="px-4 py-2 text-sm" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={options.danger ? "danger" : "primary"}
                className="px-4 py-2 text-sm"
                autoFocus
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
