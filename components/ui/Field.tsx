import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-app-sm border border-border bg-card px-3 py-2.5 text-sm text-text-primary hover:border-accent-light outline-none transition-all placeholder:text-text-muted focus:border-primary/60 focus:ring-3 focus:ring-primary/8 ${className}`}
        {...props}
      />
    );
  },
);

/** Pass  (the input's id) so screen readers and tests can find the field by its label. */
export function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-text-secondary">
      {children}
      {required && <span className="ml-0.5 text-error">*</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-error">{children}</p>;
}
