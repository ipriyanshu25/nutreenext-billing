"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(form.get("username") || ""),
        password: String(form.get("password") || ""),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setError(data.error || "Unable to sign in.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <div>
            <strong>NutreeNext</strong>
            <span>Billing</span>
          </div>
        </div>

        <div className="login-copy">
          <h1 id="login-title">Sign in</h1>
          <p>Enter your billing dashboard login ID and password.</p>
        </div>

        <form className="login-form" onSubmit={signIn}>
          <div className="field">
            <label htmlFor="login-username">Login ID</label>
            <input
              id="login-username"
              className="input login-input"
              name="username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="notice danger login-error">{error}</p>}

          <button className="btn btn-primary login-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in to Dashboard"}
          </button>
        </form>
      </section>
    </main>
  );
}
