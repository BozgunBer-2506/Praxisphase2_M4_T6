"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CombatAttackFlowState,
  type CombatLogEntry,
  type CombatRoundState,
  advanceCombatTurnState,
  combatFlowStepCopy,
  createInitialCombatAttackFlowState,
  createInitialCombatRoundState,
  getCombatActorDisplayName,
  readCombatRouteStateSnapshot,
} from "@/lib/combatState";

export default function CombatPage() {
  const [combatRoundState, setCombatRoundState] = useState<CombatRoundState>(
    createInitialCombatRoundState,
  );
  const [combatAttackFlowState, setCombatAttackFlowState] =
    useState<CombatAttackFlowState>(
      createInitialCombatAttackFlowState,
    );
  const [selectedCombatTargetId, setSelectedCombatTargetId] = useState<
    string | null
  >(null);
  const [combatStatus, setCombatStatus] = useState("Combat-Screen bereit.");
  const [combatLogEntries, setCombatLogEntries] = useState<CombatLogEntry[]>(
    [],
  );
  const visibleInitiativeOrder = combatRoundState.initiativeOrder;
  const activeCombatActor = visibleInitiativeOrder.find(
    (actor) => actor.id === combatRoundState.activeActorId,
  );
  const availableCombatTargets =
    combatRoundState.turnControl?.availableTargets ?? [];
  const combatTargetOptions =
    availableCombatTargets.length > 0
      ? availableCombatTargets
      : combatRoundState.enemies.map((enemy) => ({
          id: enemy.id,
          name: enemy.name,
          currentHp: enemy.currentHp,
          maxHp: enemy.maxHp,
          ac: enemy.ac,
          speed: enemy.speed,
          defeated: enemy.currentHp <= 0,
        }));
  const selectedCombatTarget = useMemo(
    () =>
      combatTargetOptions.find(
        (target) => target.id === selectedCombatTargetId,
      ) ?? null,
    [combatTargetOptions, selectedCombatTargetId],
  );
  const getCombatActorName = (actorId?: string | null) =>
    getCombatActorDisplayName(actorId, visibleInitiativeOrder, (combatActorId) => {
      const enemy = combatRoundState.enemies.find(
        (item) => item.id === combatActorId,
      );
      const target = combatTargetOptions.find(
        (item) => item.id === combatActorId,
      );

      return enemy?.name ?? target?.name ?? null;
    });
  const lastCombatResolution = combatRoundState.lastResolution;
  const lastCombatAttack = lastCombatResolution?.attack ?? null;
  const lastCombatDamage = lastCombatResolution?.damage ?? null;
  const lastCombatHp = lastCombatResolution?.hp ?? null;
  const allKnownEnemiesDefeated =
    combatRoundState.enemies.length > 0 &&
    combatRoundState.enemies.every((enemy) => enemy.currentHp <= 0);
  const allTargetOptionsDefeated =
    combatTargetOptions.length > 0 &&
    combatTargetOptions.every(
      (target) => target.defeated === true || (target.currentHp ?? 1) <= 0,
    );
  const isCombatFinished =
    lastCombatResolution?.combatFinished === true ||
    allKnownEnemiesDefeated ||
    allTargetOptionsDefeated;
  const lastAttackFeedback =
    lastCombatResolution && lastCombatAttack
      ? {
          actorName: getCombatActorName(lastCombatResolution.actorId),
          targetName: getCombatActorName(lastCombatResolution.targetId),
          total: lastCombatAttack.total ?? "?",
          targetAc: lastCombatAttack.targetAc ?? "?",
          hit: lastCombatAttack.hit === true,
          nat20: lastCombatAttack.nat20 === true,
          nat1: lastCombatAttack.nat1 === true,
          critical: lastCombatAttack.critical === true,
          damage: lastCombatDamage?.total ?? 0,
          remainingHp: lastCombatHp?.remainingHp ?? null,
        }
      : null;
  const attackFeedbackLabel = lastAttackFeedback?.nat20
    ? "Nat 20"
    : lastAttackFeedback?.nat1
      ? "Nat 1"
      : lastAttackFeedback?.hit
        ? "Treffer"
        : "Verfehlt";
  const attackFeedbackTone = lastAttackFeedback?.nat20
    ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-50"
    : lastAttackFeedback?.nat1
      ? "border-red-300/60 bg-red-500/15 text-red-50"
      : lastAttackFeedback?.hit
        ? "border-ember-300/55 bg-ember-500/15 text-ember-50"
        : "border-slate-400/30 bg-white/[0.06] text-slate-100";

  useEffect(() => {
    const snapshot = readCombatRouteStateSnapshot();

    if (!snapshot) {
      return;
    }

    setCombatRoundState(snapshot.roundState);
    setCombatAttackFlowState(snapshot.attackFlowState);
    setSelectedCombatTargetId(snapshot.selectedTargetId);
    setCombatStatus(snapshot.status || "Combat-Screen bereit.");
    setCombatLogEntries(snapshot.logEntries);
  }, []);

  const advanceCombatTurn = () => {
    if (isCombatFinished) {
      setCombatStatus("Kampf beendet. Rueckkehr zur Story ist vorbereitet.");
      return;
    }

    setCombatRoundState((currentState) => {
      const advanceResult = advanceCombatTurnState(currentState);

      if (!advanceResult) {
        setCombatStatus("Kein Turn-Wechsel moeglich: Initiative fehlt.");
        return currentState;
      }

      setSelectedCombatTargetId(null);
      setCombatAttackFlowState(advanceResult.attackFlowState);
      const nextActorName = getCombatActorDisplayName(
        advanceResult.roundState.activeActorId,
        advanceResult.roundState.initiativeOrder,
      );
      const nextStatus = advanceResult.isNewRound
        ? `Runde ${advanceResult.roundState.round} startet. ${nextActorName} ist am Zug.`
        : `${nextActorName} ist am Zug.`;

      setCombatStatus(nextStatus);
      setCombatLogEntries((entries) => [
        {
          id: `${Date.now()}-${advanceResult.roundState.round}-${advanceResult.roundState.turnIndex}`,
          title: advanceResult.isNewRound
            ? `Runde ${advanceResult.roundState.round} startet`
            : "Naechster Turn",
          detail: `${nextActorName} ist am Zug.`,
        },
        ...entries,
      ]);

      return advanceResult.roundState;
    });
  };

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
            {isCombatFinished ? (
              <div className="mt-3 rounded-md border border-emerald-300/45 bg-emerald-500/15 p-3">
                <p className="text-sm font-black text-emerald-50">
                  Kampf abgeschlossen
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/85">
                  Alle bekannten Gegner sind besiegt oder das Backend hat den
                  Encounter als beendet markiert. Die Rueckkehr zur Story ist
                  vorbereitet.
                </p>
                <Link
                  className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-emerald-200/40 bg-emerald-400 px-3 py-2 text-xs font-black text-ink-950 transition hover:bg-emerald-300"
                  href="/"
                >
                  Zur Story zurueckkehren
                </Link>
              </div>
            ) : null}
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Runde {combatRoundState.round}
                  </p>
                  <span className="rounded border border-ember-400/40 bg-ember-500/10 px-2 py-1 text-xs font-black text-ember-100">
                    Zug {combatRoundState.turnIndex + 1}/
                    {Math.max(visibleInitiativeOrder.length, 1)}
                  </span>
                </div>
                <p className="mt-2 text-base font-black text-slate-100">
                  {activeCombatActor?.name ?? "Wartet auf Initiative"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  <span className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    Initiative: {visibleInitiativeOrder.length || "offen"}
                  </span>
                  <span className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    Ziel: {selectedCombatTarget?.name ?? "offen"}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Ziel auswaehlen
                </p>
                <div className="mt-2 grid gap-1.5">
                  {combatTargetOptions.map((target) => {
                    const isSelected = selectedCombatTargetId === target.id;
                    const currentHp = target.currentHp ?? 0;
                    const maxHp = target.maxHp ?? 1;
                    const hpPercent = Math.max(
                      0,
                      Math.min(100, (currentHp / maxHp) * 100),
                    );

                    return (
                      <button
                        className={`rounded-md border px-2.5 py-2 text-left transition ${
                          isSelected
                            ? "border-ember-400 bg-ember-500/15"
                            : "border-white/10 bg-white/[0.04] hover:border-ember-400/60 hover:bg-ember-500/10"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                        disabled={isCombatFinished || target.defeated === true}
                        key={target.id}
                        onClick={() => setSelectedCombatTargetId(target.id)}
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 text-sm font-black text-slate-50">
                            {target.name}
                          </span>
                          <span className="shrink-0 rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[0.65rem] font-black text-slate-100">
                            AC {target.ac ?? "?"}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.68rem] text-slate-300">
                          <span>
                            HP {currentHp}/{maxHp}
                          </span>
                          <span>Speed {target.speed ?? "?"} ft.</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/40">
                          <span
                            className="block h-full rounded-full bg-red-300"
                            style={{ width: `${hpPercent}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/25 p-2.5">
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
                <p className="mt-2 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[0.68rem] text-slate-300">
                  {combatFlowStepCopy[combatAttackFlowState.step]}
                </p>
                <p className="mt-2 rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5 text-xs font-bold text-emerald-100">
                  {combatStatus}
                </p>
                <button
                  className="mt-2 w-full rounded-md border border-ember-400/45 bg-ember-500 px-3 py-2 text-[0.7rem] font-black text-ink-950 transition hover:bg-ember-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-slate-500"
                  disabled={
                    isCombatFinished ||
                    combatAttackFlowState.step !== "turnResolved" ||
                    visibleInitiativeOrder.length === 0
                  }
                  onClick={advanceCombatTurn}
                  type="button"
                >
                  Naechsten Turn vorbereiten
                </button>
              </div>

              {lastAttackFeedback ? (
                <div
                  className={`rounded-md border p-2.5 ${attackFeedbackTone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                        Letzter Wurf
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-50">
                        {lastAttackFeedback.actorName} gegen{" "}
                        {lastAttackFeedback.targetName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-ember-500 px-2 py-1 text-xs font-black text-ink-950">
                      {attackFeedbackLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <span className="rounded border border-white/10 bg-black/25 px-2 py-1">
                      <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Attack
                      </span>
                      <span className="text-sm font-black">
                        {lastAttackFeedback.total}
                      </span>
                    </span>
                    <span className="rounded border border-white/10 bg-black/25 px-2 py-1">
                      <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                        AC
                      </span>
                      <span className="text-sm font-black">
                        {lastAttackFeedback.targetAc}
                      </span>
                    </span>
                    <span className="rounded border border-white/10 bg-black/25 px-2 py-1">
                      <span className="block text-[0.55rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Schaden
                      </span>
                      <span className="text-sm font-black">
                        {lastAttackFeedback.hit ? lastAttackFeedback.damage : 0}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[0.68rem] font-bold text-slate-100">
                    {lastAttackFeedback.nat20
                      ? "Kritischer Treffer. Damage Roll wird besonders markiert."
                      : lastAttackFeedback.nat1
                        ? "Kritischer Fehlschlag. Kein Damage Roll."
                        : lastAttackFeedback.hit
                          ? `Treffer. HP danach: ${
                              lastAttackFeedback.remainingHp ?? "unbekannt"
                            }.`
                          : "Verfehlt. Kein Damage Roll."}
                  </p>
                </div>
              ) : null}

              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Combat-Log
                </p>
                {combatLogEntries.length > 0 ? (
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                    {combatLogEntries.map((entry) => (
                      <article
                        className="rounded border border-white/10 bg-white/[0.04] px-2 py-1.5"
                        key={entry.id}
                      >
                        <p className="font-black text-slate-100">
                          {entry.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {entry.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Noch keine Combat-Ereignisse. Attack Roll, Damage Roll und
                    Enemy Turn werden spaeter hier protokolliert.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        <Link
          className="inline-flex w-fit items-center rounded-md border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
          href="/"
        >
          {isCombatFinished ? "Zur Story zurueckkehren" : "Zurueck zum Story-Screen"}
        </Link>
      </section>
    </main>
  );
}
