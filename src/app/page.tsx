import { BookOpen, HeartPulse, MessageCircleQuestion, Swords } from "lucide-react";

const choices = [
  "Die Fackel heben und den Gang untersuchen",
  "Mit der fremden Stimme verhandeln",
  "Waffe ziehen und Initiative wurfeln",
];

const stats = [
  { label: "HP", value: "18 / 24", icon: HeartPulse },
  { label: "AC", value: "15", icon: Swords },
  { label: "Scene", value: "01", icon: BookOpen },
];

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-5 text-slate-50 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col justify-between gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ember-400">
              MVP Foundation
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">
              AI Narrative DnD
            </h1>
          </div>
          <button
            className="grid size-11 place-items-center rounded-md border border-white/15 bg-white/10 text-slate-100 shadow-glow"
            type="button"
            aria-label="AI Hilfe öffnen"
            title="AI Hilfe öffnen"
          >
            <MessageCircleQuestion className="size-5" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              className="rounded-md border border-white/10 bg-white/[0.07] p-3"
              key={label}
            >
              <Icon className="mb-2 size-4 text-ember-400" />
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <section className="flex flex-1 flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/70 shadow-2xl">
          <div className="flex min-h-72 flex-1 items-end bg-[linear-gradient(180deg,rgba(17,24,39,0.25),rgba(3,4,10,0.94)),url('/scene-placeholder.svg')] bg-cover bg-center p-4">
            <div>
              <p className="mb-2 inline-flex rounded-sm bg-ember-500 px-2 py-1 text-xs font-bold text-ink-950">
                Erzahler
              </p>
              <p className="text-balance text-lg font-semibold leading-snug">
                Der alte Gang atmet kalte Luft. Hinter der versiegelten Tur
                pulsiert ein Licht, als wurde es auf deinen Namen warten.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 bg-ink-950/95 p-3">
            {choices.map((choice) => (
              <button
                className="w-full rounded-md border border-white/10 bg-white/[0.06] px-3 py-3 text-left text-sm font-medium text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                key={choice}
                type="button"
              >
                {choice}
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
