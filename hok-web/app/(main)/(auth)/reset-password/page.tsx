import Link from "next/link";

/**
 * Self-service reset emails are off (security audit run 2): the Admin issues passwords
 * (Users -> Generate password), so this page only says who to ask.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="font-serif text-[28px] leading-tight text-text-primary">Forgot your password?</h1>
      <p className="text-sm text-text-secondary">Ask your Admin to set a new one for you. They will give you the new password directly.</p>
      <Link href="/login" className="text-xs text-text-muted hover:text-primary">
        Back to sign in
      </Link>
    </div>
  );
}
