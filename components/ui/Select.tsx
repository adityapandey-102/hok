import { type SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`w-full rounded-app-sm border border-border bg-card px-3 py-2.5 text-sm text-text-primary hover:border-accent-light outline-none transition-all focus:border-primary/60 focus:ring-3 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={`w-full resize-y rounded-app-sm border border-border bg-card px-3 py-2.5 text-sm text-text-primary hover:border-accent-light outline-none transition-all placeholder:text-text-muted focus:border-primary/60 focus:ring-3 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...props}
      />
    );
  },
);
