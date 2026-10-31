/**
 * Email sign-in links (password reset / invite) are turned off until HOK has an
 * email service (owner decision, security audit run 1). The previous page signed in
 * whatever tokens a link carried, replacing the visitor's own session, so a crafted
 * link could put a signed-in person into someone else's account. Re-enable with a
 * single-use code bound to the browser that asked for the email.
 */
export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-app-lg border border-border bg-card p-6 text-center shadow-app-md">
        <h1 className="font-serif text-[26px] leading-tight text-text-primary">Link not available</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign-in links aren&apos;t used yet. Ask your Admin for a new password, then sign in on the login page.</p>
      </div>
    </div>
  );
}
