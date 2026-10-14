"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../api/authApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.updatePassword({ newPassword: password });
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
        <h1 className="font-serif text-[26px] leading-tight text-text-primary">Set a new password</h1>
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

      <Button type="submit" disabled={loading} className="mt-1 w-full">
        {loading ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
