"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastType, string> = {
  success: "bg-success text-white",
  error: "bg-error text-white",
  info: "bg-primary text-white",
};

let nextToastId = 0;

/**
 * Bottom-right, auto-dismissing notifications -- ported from the
 * prototype's showToast()/`.toast-container` (3200ms display, success/error/
 * info variants, slide-in from the right). Mounted once at the root layout
 * so any client component can call useToast() without its own provider.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed right-6 bottom-6 z-999 flex flex-col gap-2 print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-toast-slide flex max-w-[300px] items-center gap-2 rounded-app px-4 py-3 text-[13px] font-medium shadow-app-lg ring-1 ring-white/15 ${TONE_CLASSES[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
