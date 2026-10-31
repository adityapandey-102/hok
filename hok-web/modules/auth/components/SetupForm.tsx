"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../api/authApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";

/**
 * First-time setup (/setup): creates the very first Admin. Self-disabling --
 * once an Admin exists, every other account is created by an Admin from
 * Administration → Users (no public sign-up). needleye's RegisterForm, for HOK.
 */
export function SetupForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(true);
  const [setupKey, setSetupKey] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .bootstrapStatus()
      .then((data) => setAdminExists(Boolean(data.adminExists)))
      .catch(() => setAdminExists(true))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.bootstrap({ setupKey, email, password, fullName });
      await authApi.login({ email, password });

      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-text-muted">Checking setup status…</p>;
  }

  if (adminExists) {
    return (
      <div className="text-center">
        <h1 className="font-serif text-[28px] leading-tight text-text-primary">Invite-only</h1>
        <p className="mt-2 text-sm text-text-secondary">
          HOK is already set up. Ask your Admin to create your account from Administration → Users.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-[28px] leading-tight text-text-primary">First-time setup</h1>
        <p className="text-xs text-text-muted">
          No Admin account exists yet. Create the first one -- every other account is created from here afterward.
        </p>
      </div>

      <div>
        <FieldLabel required>Setup key</FieldLabel>
        <Input type="password" required autoComplete="off" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="BOOTSTRAP_TOKEN from the server settings" />
      </div>

      <div>
        <FieldLabel required>Full name</FieldLabel>
        <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Aditya Pandey" />
      </div>

      <div>
        <FieldLabel required>Email</FieldLabel>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div>
        <FieldLabel required>Password</FieldLabel>
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
        {loading ? "Creating account…" : "Create Admin account"}
      </Button>
    </form>
  );
}
