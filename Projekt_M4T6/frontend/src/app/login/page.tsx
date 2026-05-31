import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-ember-300"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Zurück zur Szene
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-ember-400">
              Falkenwacht Login
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Zugang zum Kampagnenportal
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-ember-400/30 bg-ink-950/70 px-3 py-2 shadow-glow">
            <ShieldCheck className="size-4 text-ember-400" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <p className="text-xs font-semibold text-slate-100">
                Auth-UI vorbereitet
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-md border border-white/10 bg-ink-950/75 p-4 shadow-2xl">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.18em] text-ember-300">
              Account
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Einloggen</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Nach dem Login gelangst du in den Main-Bereich mit Kampagne,
              Sessions und offenen Speicherständen.
            </p>
          </div>

          <form className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">E-Mail</span>
              <span className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-3">
                <Mail className="size-4 text-ember-300" />
                <input
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="marcel@example.com"
                  type="email"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">
                Passwort
              </span>
              <span className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-3">
                <LockKeyhole className="size-4 text-ember-300" />
                <input
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="Passwort"
                  type="password"
                />
              </span>
            </label>

            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
              href="/campaigns"
            >
              <KeyRound className="size-4" />
              Einloggen
            </Link>
            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
              href="/campaigns"
            >
              <UserPlus className="size-4" />
              Neuen Account registrieren
            </Link>
          </form>
        </section>
      </section>
    </main>
  );
}
