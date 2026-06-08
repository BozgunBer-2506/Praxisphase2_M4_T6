"use client";

import Link from "next/link";
import { ArrowLeft, Swords, Skull, Shield, Zap, ChevronRight } from "lucide-react";
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

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.7)";

export default function CombatPage() {
  const [combatRoundState, setCombatRoundState] = useState<CombatRoundState>(createInitialCombatRoundState);
  const [combatAttackFlowState, setCombatAttackFlowState] = useState<CombatAttackFlowState>(createInitialCombatAttackFlowState);
  const [selectedCombatTargetId, setSelectedCombatTargetId] = useState<string | null>(null);
  const [combatStatus, setCombatStatus] = useState("Combat-Screen bereit.");
  const [combatLogEntries, setCombatLogEntries] = useState<CombatLogEntry[]>([]);

  const visibleInitiativeOrder = combatRoundState.initiativeOrder;
  const activeCombatActor = visibleInitiativeOrder.find((actor) => actor.id === combatRoundState.activeActorId);
  const availableCombatTargets = combatRoundState.turnControl?.availableTargets ?? [];
  const combatTargetOptions = availableCombatTargets.length > 0
    ? availableCombatTargets
    : combatRoundState.enemies.map((enemy) => ({
        id: enemy.id, name: enemy.name, currentHp: enemy.currentHp,
        maxHp: enemy.maxHp, ac: enemy.ac, speed: enemy.speed, defeated: enemy.currentHp <= 0,
      }));
  const selectedCombatTarget = useMemo(
    () => combatTargetOptions.find((target) => target.id === selectedCombatTargetId) ?? null,
    [combatTargetOptions, selectedCombatTargetId],
  );
  const getCombatActorName = (actorId?: string | null) =>
    getCombatActorDisplayName(actorId, visibleInitiativeOrder, (combatActorId) => {
      const enemy = combatRoundState.enemies.find((item) => item.id === combatActorId);
      const target = combatTargetOptions.find((item) => item.id === combatActorId);
      return enemy?.name ?? target?.name ?? null;
    });
  const lastCombatResolution = combatRoundState.lastResolution;
  const lastCombatAttack = lastCombatResolution?.attack ?? null;
  const lastCombatDamage = lastCombatResolution?.damage ?? null;
  const lastCombatHp = lastCombatResolution?.hp ?? null;
  const allKnownEnemiesDefeated = combatRoundState.enemies.length > 0 && combatRoundState.enemies.every((e) => e.currentHp <= 0);
  const allTargetOptionsDefeated = combatTargetOptions.length > 0 && combatTargetOptions.every((t) => t.defeated === true || (t.currentHp ?? 1) <= 0);
  const isCombatFinished = lastCombatResolution?.combatFinished === true || allKnownEnemiesDefeated || allTargetOptionsDefeated;
  const lastAttackFeedback = lastCombatResolution && lastCombatAttack ? {
    actorName: getCombatActorName(lastCombatResolution.actorId),
    targetName: getCombatActorName(lastCombatResolution.targetId),
    total: lastCombatAttack.total ?? "?",
    targetAc: lastCombatAttack.targetAc ?? "?",
    hit: lastCombatAttack.hit === true,
    nat20: lastCombatAttack.nat20 === true,
    nat1: lastCombatAttack.nat1 === true,
    damage: lastCombatDamage?.total ?? 0,
    remainingHp: lastCombatHp?.remainingHp ?? null,
  } : null;
  const attackFeedbackLabel = lastAttackFeedback?.nat20 ? "Nat 20" : lastAttackFeedback?.nat1 ? "Nat 1" : lastAttackFeedback?.hit ? "Treffer" : "Verfehlt";

  useEffect(() => {
    const snapshot = readCombatRouteStateSnapshot();
    if (!snapshot) return;
    setCombatRoundState(snapshot.roundState);
    setCombatAttackFlowState(snapshot.attackFlowState);
    setSelectedCombatTargetId(snapshot.selectedTargetId);
    setCombatStatus(snapshot.status || "Combat-Screen bereit.");
    setCombatLogEntries(snapshot.logEntries);
  }, []);

  const advanceCombatTurn = () => {
    if (isCombatFinished) { setCombatStatus("Kampf beendet."); return; }
    setCombatRoundState((currentState) => {
      const advanceResult = advanceCombatTurnState(currentState);
      if (!advanceResult) { setCombatStatus("Kein Turn-Wechsel möglich."); return currentState; }
      setSelectedCombatTargetId(null);
      setCombatAttackFlowState(advanceResult.attackFlowState);
      const nextActorName = getCombatActorDisplayName(advanceResult.roundState.activeActorId, advanceResult.roundState.initiativeOrder);
      const nextStatus = advanceResult.isNewRound
        ? `Runde ${advanceResult.roundState.round} startet. ${nextActorName} ist am Zug.`
        : `${nextActorName} ist am Zug.`;
      setCombatStatus(nextStatus);
      setCombatLogEntries((entries) => [{
        id: `${Date.now()}-${advanceResult.roundState.round}-${advanceResult.roundState.turnIndex}`,
        title: advanceResult.isNewRound ? `Runde ${advanceResult.roundState.round} startet` : "Nächster Turn",
        detail: `${nextActorName} ist am Zug.`,
      }, ...entries]);
      return advanceResult.roundState;
    });
  };

  return (
    <div className="min-h-dvh flex flex-col text-white" style={{background: "#050505"}}>
      {/* Header */}
      <header className="flex-none h-14 flex items-center px-4 gap-3 border-b border-white/[0.08]" style={{background: "rgba(8,8,8,0.97)", backdropFilter: "blur(20px)"}}>
        <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[0.65rem] font-bold font-cinzel uppercase tracking-wide text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 pointer-events-none">
          <div className="w-12 h-px" style={{background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5))"}} />
          <div className="w-1.5 h-1.5 rotate-45" style={{background: GOLD, opacity: 0.7}} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-eagle.png" alt="Falkenwacht" width={20} height={20} className="object-contain opacity-90" />
          <span className="text-sm font-bold tracking-widest font-cinzel" style={{color: GOLD}}>Falkenwacht</span>
          <div className="w-1.5 h-1.5 rotate-45" style={{background: GOLD, opacity: 0.7}} />
          <div className="w-12 h-px" style={{background: "linear-gradient(90deg, rgba(212,175,55,0.5), transparent)"}} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.65rem] font-bold font-cinzel uppercase tracking-wide border" style={{color: "#fca5a5", borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)"}}>
            <Swords className="w-3 h-3" /> Kampf
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl flex flex-col gap-5">

          {/* Combat Finished */}
          {isCombatFinished && (
            <div className="rounded-lg p-5 text-center" style={{background: "rgba(16,24,8,0.9)", border: "1px solid rgba(134,239,172,0.3)"}}>
              <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.25em] text-green-400">Sieg</p>
              <h2 className="mt-1 text-xl font-bold font-cinzel text-green-300">Kampf abgeschlossen</h2>
              <Link href="/" className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold font-cinzel uppercase tracking-wide transition-all" style={{background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.4)", color: GOLD}}>
                Zur Story zurückkehren <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            {/* Left: Initiative + Enemies */}
            <div className="flex flex-col gap-4">

              {/* Round info */}
              <div className="rounded-lg p-4" style={{background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)"}}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em]" style={{color: GOLD_DIM}}>Kampfrunde</p>
                    <p className="text-2xl font-bold font-cinzel mt-0.5" style={{color: GOLD}}>{combatRoundState.round || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] text-slate-500">Am Zug</p>
                    <p className="text-base font-bold text-slate-100 mt-0.5">{activeCombatActor?.name ?? "Wartet..."}</p>
                    <p className="text-[0.6rem] text-slate-500 mt-0.5">Zug {combatRoundState.turnIndex + 1}/{Math.max(visibleInitiativeOrder.length, 1)}</p>
                  </div>
                </div>
                {/* Initiative order */}
                {visibleInitiativeOrder.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {visibleInitiativeOrder.map((actor) => (
                      <span key={actor.id} className="px-2 py-0.5 rounded text-[0.6rem] font-bold font-cinzel uppercase" style={{
                        background: actor.id === combatRoundState.activeActorId ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)",
                        border: actor.id === combatRoundState.activeActorId ? "1px solid rgba(212,175,55,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color: actor.id === combatRoundState.activeActorId ? GOLD : "#94a3b8",
                      }}>
                        {actor.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Enemies */}
              {combatRoundState.enemies.length > 0 && (
                <div className="rounded-lg p-4" style={{background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)"}}>
                  <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] mb-3" style={{color: GOLD_DIM}}>
                    <Skull className="w-3 h-3 inline mr-1.5" />Gegner
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {combatRoundState.enemies.map((enemy) => {
                      const hpPct = Math.max(0, Math.min(100, (enemy.currentHp / enemy.maxHp) * 100));
                      const defeated = enemy.currentHp <= 0;
                      return (
                        <div key={enemy.id} className="rounded-md p-3" style={{background: defeated ? "rgba(255,255,255,0.02)" : "rgba(180,30,30,0.08)", border: defeated ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(239,68,68,0.2)", opacity: defeated ? 0.5 : 1}}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-100">{enemy.name}</p>
                            <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded shrink-0" style={{background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5"}}>
                              {enemy.currentHp}/{enemy.maxHp} HP
                            </span>
                          </div>
                          <p className="text-[0.6rem] text-slate-500 mt-0.5">AC {enemy.ac} · Speed {enemy.speed} ft.</p>
                          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{background: "rgba(0,0,0,0.4)"}}>
                            <div className="h-full rounded-full transition-all" style={{width: `${hpPct}%`, background: hpPct > 50 ? "#86efac" : hpPct > 25 ? "#fbbf24" : "#f87171"}} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Last attack result */}
              {lastAttackFeedback && (
                <div className="rounded-lg p-4" style={{
                  background: lastAttackFeedback.nat20 ? "rgba(16,24,8,0.9)" : lastAttackFeedback.nat1 ? "rgba(24,8,8,0.9)" : "rgba(10,8,5,0.85)",
                  border: lastAttackFeedback.nat20 ? "1px solid rgba(134,239,172,0.3)" : lastAttackFeedback.nat1 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(212,175,55,0.2)",
                }}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] text-slate-400">Letzter Wurf</p>
                    <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold font-cinzel uppercase" style={{
                      background: lastAttackFeedback.nat20 ? "rgba(134,239,172,0.2)" : lastAttackFeedback.hit ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.06)",
                      color: lastAttackFeedback.nat20 ? "#86efac" : lastAttackFeedback.hit ? GOLD : "#94a3b8",
                    }}>
                      {attackFeedbackLabel}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-200">{lastAttackFeedback.actorName} → {lastAttackFeedback.targetName}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      {label: "Angriff", value: lastAttackFeedback.total},
                      {label: "AC", value: lastAttackFeedback.targetAc},
                      {label: "Schaden", value: lastAttackFeedback.hit ? lastAttackFeedback.damage : 0},
                    ].map(({label, value}) => (
                      <div key={label} className="rounded p-2" style={{background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)"}}>
                        <p className="text-[0.55rem] font-cinzel uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="text-lg font-bold font-cinzel mt-0.5" style={{color: GOLD}}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Actions + Log */}
            <div className="flex flex-col gap-4">

              {/* Target selection */}
              {combatTargetOptions.length > 0 && (
                <div className="rounded-lg p-4" style={{background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)"}}>
                  <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] mb-3" style={{color: GOLD_DIM}}>
                    <Shield className="w-3 h-3 inline mr-1.5" />Ziel wählen
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {combatTargetOptions.map((target) => {
                      const isSelected = selectedCombatTargetId === target.id;
                      const hpPct = Math.max(0, Math.min(100, ((target.currentHp ?? 0) / (target.maxHp ?? 1)) * 100));
                      return (
                        <button
                          key={target.id}
                          disabled={isCombatFinished || target.defeated === true}
                          onClick={() => setSelectedCombatTargetId(target.id)}
                          className="rounded-md p-2.5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: isSelected ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                            border: isSelected ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.08)",
                          }}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-100">{target.name}</span>
                            <span className="text-[0.6rem] font-bold shrink-0" style={{color: "#94a3b8"}}>AC {target.ac ?? "?"}</span>
                          </div>
                          <p className="text-[0.6rem] text-slate-500 mt-0.5">HP {target.currentHp}/{target.maxHp}</p>
                          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{background: "rgba(0,0,0,0.4)"}}>
                            <div className="h-full rounded-full" style={{width: `${hpPct}%`, background: "#f87171"}} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Flow + Status + Advance */}
              <div className="rounded-lg p-4" style={{background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)"}}>
                <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] mb-3" style={{color: GOLD_DIM}}>
                  <Zap className="w-3 h-3 inline mr-1.5" />Aktionsfluss
                </p>
                <div className="grid grid-cols-3 gap-1 text-center mb-3">
                  {["Aktion", "Ziel", "Roll"].map((step, index) => (
                    <span key={step} className="rounded py-1 text-[0.58rem] font-bold font-cinzel uppercase tracking-wide" style={{
                      background: combatAttackFlowState.step === "idle" && index === 0 ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)",
                      border: combatAttackFlowState.step === "idle" && index === 0 ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.08)",
                      color: combatAttackFlowState.step === "idle" && index === 0 ? GOLD : "#64748b",
                    }}>
                      {index + 1} {step}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-2 px-1">{combatFlowStepCopy[combatAttackFlowState.step]}</p>
                <p className="text-xs font-semibold px-2 py-1.5 rounded mb-3" style={{background: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.15)", color: "#86efac"}}>
                  {combatStatus}
                </p>
                <button
                  disabled={isCombatFinished || combatAttackFlowState.step !== "turnResolved" || visibleInitiativeOrder.length === 0}
                  onClick={advanceCombatTurn}
                  className="w-full rounded-md py-2.5 text-xs font-bold font-cinzel uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.4)", color: GOLD}}
                  type="button"
                >
                  Nächsten Turn vorbereiten
                </button>
              </div>

              {/* Combat Log */}
              <div className="rounded-lg p-4" style={{background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)"}}>
                <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em] mb-3" style={{color: GOLD_DIM}}>Combat-Log</p>
                {combatLogEntries.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {combatLogEntries.map((entry) => (
                      <article key={entry.id} className="rounded p-2" style={{background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)"}}>
                        <p className="text-xs font-bold text-slate-200">{entry.title}</p>
                        <p className="text-[0.65rem] text-slate-500 mt-0.5">{entry.detail}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">Noch keine Kampfereignisse.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
