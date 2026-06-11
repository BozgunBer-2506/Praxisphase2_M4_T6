"use client";

import { ArrowLeft, KeyRound, LockKeyhole, UserPlus, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, register } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchTab(t: "login" | "register") {
    setTab(t);
    setUsername("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = tab === "login";

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-8 text-slate-50"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 60%), #06080f" }}
    >
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <Link
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 mb-6"
            href="/"
          >
            <ArrowLeft className="size-3" />
            Zurück zur Szene
          </Link>
          <p className="text-[0.6rem] uppercase tracking-[0.25em] font-cinzel mb-1 mt-4" style={{ color: "rgba(212,175,55,0.75)" }}>
            Falkenwacht
          </p>
          <h1 className="text-2xl font-bold font-cinzel">Kampagnenportal</h1>
        </div>

        <div className="rounded-xl shadow-2xl overflow-hidden" style={{ background: "rgba(8,10,28,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>

          <div className="grid grid-cols-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              className="py-3.5 text-sm font-semibold font-cinzel uppercase tracking-wider transition"
              style={isLogin
                ? { color: "#d4af37", borderBottom: "2px solid #d4af37", background: "rgba(212,175,55,0.05)" }
                : { color: "#64748b", borderBottom: "2px solid transparent", background: "transparent" }}
              onClick={() => switchTab("login")}
              type="button"
            >
              Einloggen
            </button>
            <button
              className="py-3.5 text-sm font-semibold font-cinzel uppercase tracking-wider transition"
              style={!isLogin
                ? { color: "#d4af37", borderBottom: "2px solid #d4af37", background: "rgba(212,175,55,0.05)" }
                : { color: "#64748b", borderBottom: "2px solid transparent", background: "transparent" }}
              onClick={() => switchTab("register")}
              type="button"
            >
              Registrieren
            </button>
          </div>

          <form className="p-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isLogin
                ? "Melde dich mit deinem bestehenden Konto an."
                : "Erstelle ein neues Konto, um deine Kampagne zu speichern."}
            </p>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Benutzername</span>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <User className="size-4 shrink-0 text-slate-500" />
                <input
                  autoComplete="username"
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  disabled={loading}
                  minLength={3}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Mind. 3 Zeichen"
                  required
                  type="text"
                  value={username}
                />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Passwort</span>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <LockKeyhole className="size-4 shrink-0 text-slate-500" />
                <input
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  disabled={loading}
                  minLength={6}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mind. 6 Zeichen"
                  required
                  type="password"
                  value={password}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold font-cinzel uppercase tracking-widest transition disabled:opacity-50 hover:opacity-90"
              disabled={loading}
              style={{ background: "rgba(212,175,55,0.18)", border: "1px solid rgba(212,175,55,0.5)", color: "#f0e6cc" }}
              type="submit"
            >
              {isLogin ? (
                <>
                  <KeyRound className="size-4" />
                  {loading ? "Wird eingeloggt..." : "Einloggen"}
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  {loading ? "Wird registriert..." : "Konto erstellen"}
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              {isLogin ? "Noch kein Konto? " : "Bereits registriert? "}
              <button
                className="text-amber-400 hover:text-amber-300 transition"
                onClick={() => switchTab(isLogin ? "register" : "login")}
                type="button"
              >
                {isLogin ? "Jetzt registrieren" : "Einloggen"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
