"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../api/authApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The change ends every session (security audit run 1), so sign this device straight back in.
      const { profile } = await authApi.me();
      await authApi.updatePassword({ currentPassword: current, newPassword: password });
      await authApi.login({ email: profile.email, password });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-[28px] leading-tight text-text-primary">Set a new password</h1>
      </div>

      <p className="text-sm text-text-secondary">Your other devices are signed out after the change; this one stays signed in.</p>

      <div>
        <FieldLabel required>Current password</FieldLabel>
        <Input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>

      <div>
        <FieldLabel required>New password</FieldLabel>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" disabled={loading} className="mt-1 w-full py-3">
        {loading ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
