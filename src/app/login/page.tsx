"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-[var(--spacing-xl)]">
      <div
        className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)]"
        style={{ boxShadow: "var(--shadow-soft-shadow)" }}
      >
        <h1 className="type-headline-medium2 mb-[var(--spacing-sm)] text-on-surface">
          Sign in
        </h1>
        <p className="type-body-medium2 mb-[var(--spacing-xl)] text-on-surface-variant">
          Welcome back. Sign in to continue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--spacing-base)]">
          <div className="flex flex-col gap-[var(--spacing-xs)]">
            <label htmlFor="login-email" className="type-label-large2 text-on-surface">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-[var(--spacing-md)] py-[var(--spacing-sm)] text-on-surface outline-none transition-shadow focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <div className="flex flex-col gap-[var(--spacing-xs)]">
            <label htmlFor="login-password" className="type-label-large2 text-on-surface">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-[var(--spacing-md)] py-[var(--spacing-sm)] text-on-surface outline-none transition-shadow focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="type-body-small2 text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="type-button2 mt-[var(--spacing-xs)] rounded-md bg-primary px-[var(--spacing-base)] py-[var(--spacing-sm)] text-white transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="type-body-medium2 mt-[var(--spacing-base)] text-center text-on-surface-variant">
        No account?{" "}
        <a href="/signup" className="font-medium text-secondary underline">
          Sign up
        </a>
      </p>
    </main>
  );
}
