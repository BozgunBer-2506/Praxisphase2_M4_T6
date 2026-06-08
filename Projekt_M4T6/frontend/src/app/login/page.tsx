"use client";

import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, register } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, password);
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-y-auto px-4 py-5 text-slate-50 sm:px-6 lg:px-8" style={{maxHeight: '100dvh'}}>
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-slate-100"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Zurück zur Szene
            </Link>
            <p className="mt-4 text-[0.65rem] uppercase tracking-[0.22em] font-cinzel" style={{color: 'rgba(212,175,55,0.8)'}}>
              Falkenwacht Login
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight font-cinzel">
              Zugang zum Kampagnenportal
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-md px-3 py-2" style={{background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)'}}>
            <ShieldCheck className="size-4" style={{color: '#d4af37'}} />
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400 font-cinzel">
                Status
              </p>
              <p className="text-xs font-semibold text-slate-100">
                Backend verbunden
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-md p-4 shadow-2xl" style={{background: 'rgba(4,6,22,0.85)', border: '1px solid rgba(255,255,255,0.08)'}}>
          <div className="mb-5">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] font-cinzel" style={{color: 'rgba(212,175,55,0.7)'}}>
              Account
            </p>
            <h2 className="mt-1 text-2xl font-semibold font-cinzel">Einloggen</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Nach dem Login gelangst du in den Main-Bereich mit Kampagne,
              Sessions und offenen Speicherständen.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Benutzername</span>
              <span className="flex items-center gap-2 rounded-md px-3 py-3" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'}}>
                <User className="size-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  disabled={loading}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Benutzername"
                  required
                  type="text"
                  value={username}
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Passwort</span>
              <span className="flex items-center gap-2 rounded-md px-3 py-3" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'}}>
                <LockKeyhole className="size-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort"
                  required
                  type="password"
                  value={password}
                />
              </span>
            </label>

            {error ? (
              <div className="rounded-md px-3 py-2 text-sm" style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5'}}>
                {error}
              </div>
            ) : null}

            <div className="grid gap-2 pt-1">
              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-bold transition disabled:opacity-50 font-cinzel uppercase tracking-wide"
                disabled={loading}
                style={{background: 'rgba(212,175,55,0.18)', border: '1px solid rgba(212,175,55,0.45)', color: '#f0e6cc'}}
                type="submit"
              >
                <KeyRound className="size-4" />
                {loading ? "Wird eingeloggt..." : "Einloggen"}
              </button>

              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition disabled:opacity-50"
                disabled={loading}
                onClick={handleRegister}
                style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0'}}
                type="button"
              >
                <UserPlus className="size-4" />
                {loading ? "Wird registriert..." : "Neuen Account registrieren"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
