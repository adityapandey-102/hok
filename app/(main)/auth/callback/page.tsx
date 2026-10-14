"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "../../../../modules/auth/api/authApi";

/**
 * Lands here from a password-reset or invite email link. This local Supabase
 * project (and most default configs) uses the implicit flow, so GoTrue hands
 * back tokens directly in the URL fragment (`#access_token=...`) -- a
 * fragment never reaches a server, so this has to be a client page, not a
 * Route Handler. A `?code=` query param (PKCE) is also handled, in case the
 * project is ever reconfigured for it.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") || "/app";
    const code = searchParams.get("code");

    async function complete() {
      if (code) {
        await authApi.exchangeCode({ code });
        router.replace(next);
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        // Hand the fragment tokens to the server so the refresh token is
        // stored httpOnly (JS can't set an httpOnly cookie itself).
        await authApi.establish({ accessToken, refreshToken });
        router.replace(next);
        return;
      }

      throw new Error(hashParams.get("error_description")?.replace(/\+/g, " ") || "This link is invalid or has expired.");
    }

    complete().catch((err) => setError(err instanceof Error ? err.message : "This link is invalid or has expired."));
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-app-lg border border-border bg-card p-6 text-center shadow-app-md">
        {error ? (
          <>
            <h1 className="font-serif text-[26px] leading-tight text-text-primary">Link expired</h1>
            <p className="mt-2 text-sm text-text-secondary">{error}</p>
          </>
        ) : (
          <p className="text-sm text-text-muted">Signing you in…</p>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackContent />
    </Suspense>
  );
}
