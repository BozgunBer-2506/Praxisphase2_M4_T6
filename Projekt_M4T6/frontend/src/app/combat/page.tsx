"use client";

import Link from "next/link";
import {
  createInitialCombatAttackFlowState,
  createInitialCombatRoundState,
} from "@/lib/combatState";

export default function CombatPage() {
  const combatRoundState = createInitialCombatRoundState();
  const combatAttackFlowState = createInitialCombatAttackFlowState();

  return (
    <main className="min-h-dvh bg-ink-950 px-4 py-5 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col gap-4">
        <header className="rounded-md border border-white/10 bg-white/[0.05] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember-300">
            Falkenwacht Combat
          </p>
          <h1 className="mt-2 text-2xl font-black">Combat-Screen</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Diese Route ist vorbereitet, damit Kampfszenen kuenftig getrennt vom
            Story-Screen aufgebaut werden koennen.
          </p>
        </header>

        <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="rounded-md border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Kampfflaeche
            </p>
            <div className="mt-3 grid min-h-80 rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4">
              <div className="grid h-full place-items-center text-center text-sm text-slate-400">
                Combat-Bild, Battle-Map oder taktische Ansicht werden hier
                ausgelagert.
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {combatRoundState.enemies.map((enemy) => (
                  <article
                    className="rounded-md border border-red-400/30 bg-red-500/10 p-3"
                    key={enemy.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-black text-red-50">
                          {enemy.name}
                        </h2>
                        <p className="mt-1 text-xs text-slate-300">
                          AC {enemy.ac} | Speed {enemy.speed} ft.
                        </p>
                      </div>
                      <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs font-black text-slate-100">
                        {enemy.currentHp}/{enemy.maxHp} HP
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-red-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, (enemy.currentHp / enemy.maxHp) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-md border border-white/10 bg-ink-950/80 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ember-300">
              Combat-Panel
            </p>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Initiative
                  </p>
                  <span className="rounded border border-ember-400/40 bg-ember-500/10 px-2 py-1 text-xs font-black text-ember-100">
                    Runde {combatRoundState.round}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Noch nicht gestartet. Die spaetere Combat-Route liest hier
                  InitiativeOrder, aktiven Actor und TurnIndex.
                </p>
              </div>

              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Aktiver Actor
                </p>
                <p className="mt-2 text-lg font-black text-slate-100">
                  {combatRoundState.activeActorId ?? "Wartet auf Initiative"}
                </p>
              </div>

              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Flow
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[0.58rem] font-black uppercase tracking-[0.08em]">
                  {["Aktion", "Ziel", "Roll"].map((step, index) => (
                    <span
                      className={`rounded border px-1 py-1 ${
                        combatAttackFlowState.step === "idle" && index === 0
                          ? "border-ember-400/60 bg-ember-500 text-ink-950"
                          : "border-white/10 bg-white/[0.06] text-slate-400"
                      }`}
                      key={step}
                    >
                      {index + 1} {step}
                    </span>
                  ))}
                </div>
                <p className="mt-2 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-300">
                  Status: {combatAttackFlowState.step}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <Link
          className="inline-flex w-fit items-center rounded-md border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
          href="/"
        >
          Zurueck zum Story-Screen
        </Link>
      </section>
    </main>
  );
}
