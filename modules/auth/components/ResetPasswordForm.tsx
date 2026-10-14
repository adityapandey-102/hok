"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "../api/authApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.requestPasswordReset({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="font-serif text-[26px] leading-tight text-text-primary">Check your email</h1>
        <p className="mt-2 text-sm text-text-secondary">
          If an account exists for {email}, a password reset link has been sent.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-[26px] leading-tight text-text-primary">Reset password</h1>
        <p className="text-xs text-text-muted">We&apos;ll email you a link to set a new password.</p>
      </div>

      <div>
        <FieldLabel required>Email</FieldLabel>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" disabled={loading} className="mt-1 w-full">
        {loading ? "Sending…" : "Send reset link"}
      </Button>

      <Link href="/login" className="text-center text-xs text-text-muted hover:text-primary">
        Back to sign in
      </Link>
    </form>
  );
}
