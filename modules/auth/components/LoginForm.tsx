"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "../api/authApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.login({ email, password });
      router.push(searchParams.get("next") || "/app");
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
        <h1 className="mb-1.5 font-serif text-[28px] leading-tight text-text-primary">Welcome back</h1>
        <p className="text-sm text-text-muted">Sign in to your workspace. Staff access is invite-only, so ask your manager if you need an account.</p>
      </div>

      <div>
        <FieldLabel required htmlFor="login-email">Email</FieldLabel>
        <div className="relative">
          <Icon name="user" size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@houseofkhalak.com"
            className="py-3 pl-10"
          />
        </div>
      </div>

      <div>
        <FieldLabel required htmlFor="login-password">Password</FieldLabel>
        <div className="relative">
          <Icon name="lock" size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="py-3 pr-11 pl-10"
          />
          {/* type="button" so it never submits the form. */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-app text-text-muted transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
          >
            <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" disabled={loading} className="mt-1 w-full py-3">
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <Link href="/reset-password" className="py-2 transition-colors hover:text-primary">
          Forgot password?
        </Link>
        <Link href="/register" className="py-2 transition-colors hover:text-primary">
          First-time setup
        </Link>
      </div>
    </form>
  );
}
