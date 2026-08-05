"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passphrase }),
    });

    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Login failed");
      return;
    }

    router.push(searchParams.get("next") ?? "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Muhasabah</div>
          <h1 className="mt-2 text-2xl font-bold">Admin Login</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Enter the single-admin passphrase to open the dashboard.</p>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase"
          />
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
