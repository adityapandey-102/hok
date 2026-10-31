import { type InputHTMLAttributes, forwardRef } from "react";

/**
 * Text fields and selects share one look: a soft filled well (no outline at
 * rest), a crisp ring in focus -- the way Apple's forms read (redesign
 * 2026-10-23). The well is light on white groups and on the page alike.
 */
export const FIELD =
  "w-full rounded-app border border-transparent bg-accent-bg/70 px-3.5 py-2.5 text-[15px] text-text-primary outline-none transition-[background-color,box-shadow,border-color] duration-150 placeholder:text-text-muted hover:bg-accent-bg focus:border-primary/40 focus:bg-card focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`${FIELD} ${className}`}
        {...props}
      />
    );
  },
);

/** Pass  (the input's id) so screen readers and tests can find the field by its label. */
export function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-text-secondary">
      {children}
      {required && <span className="ml-0.5 text-error">*</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-error">{children}</p>;
}
