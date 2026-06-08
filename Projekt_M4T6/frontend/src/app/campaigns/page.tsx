"use client";

import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Clock3,
  LogIn,
  Trash2,
  Play,
  Save,
  ScrollText,
  Sparkles,
  Swords,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { characters, type CharacterId } from "@/data/scenes";
import { getUsername, getUserId, isLoggedIn, logout } from "@/lib/auth";
import { listBackendSaves } from "@/lib/backendApi";

const SAVE_KEY = "falkenwacht.saveStates";
const LAST_SAVE_KEY = "falkenwacht.lastSave";
const MAX_ACCOUNT_SAVES = 15;
const MAX_CAMPAIGN_SAVES = 5;

type SaveState = {
  id: string;
  campaignTitle: string;
  sessionTitle: string;
  sceneId: string;
  sceneTitle: string;
  characterId: CharacterId;
  choiceLabel: string;
  createdAt: string;
};

const sessions = [
  {
    title: "Session 1",
    subtitle: "Das gestohlene Ei",
    status: "Aktiv",
    description:
      "Charakterwahl, Auftrag in der Abenteurergilde und erste Spurensuche in Falkenwacht.",
  },
  {
    title: "Session 2",
    subtitle: "Krähenloch-Außenlager",
    status: "In Progress",
    description:
      "Gehört zur aktuellen Kampagne und erweitert die Suche außerhalb der sicheren Stadtbereiche.",
  },
  {
    title: "Session 3",
    subtitle: "Stadt unter der Unterstadt",
    status: "Coming Soon",
    description:
      "Gehört zur aktuellen Kampagne und führt später in die tieferen Ebenen von Falkenwacht.",
  },
];

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.7)";

export default function CampaignsPage() {
  const router = useRouter();
  const [saveStates, setSaveStates] = useState<SaveState[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    setUsername(getUsername());
    setUserId(getUserId());
    setLoaded(true);
  }, [router]);

  useEffect(() => {
    if (!isAccountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAccountOpen]);

  useEffect(() => {
    if (!loaded) return;

    let localSaves: SaveState[] = [];
    try {
      localSaves = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "[]");
    } catch {
      localSaves = [];
    }

    listBackendSaves()
      .then((backendSaves) => {
        const localIds = new Set(localSaves.map((s) => s.id));
        const backendOnly = backendSaves
          .filter((bs) => !localIds.has(`backend-${bs.id}`))
          .map((bs) => {
            const charId = (bs.character_id === "ryu" || bs.character_id === "ayane")
              ? (bs.character_id as CharacterId)
              : "ryu";
            return {
              id: `backend-${bs.id}`,
              campaignTitle: "Falkenwacht - Die Korruption der Greifenstadt",
              sessionTitle: "Session 1",
              sceneId: "prolog",
              sceneTitle: `Szene ${bs.scene_number}`,
              characterId: charId,
              choiceLabel: bs.slot_name,
              createdAt: new Date().toISOString(),
            } satisfies SaveState;
          });
        setSaveStates([...localSaves, ...backendOnly]);
      })
      .catch(() => {
        setSaveStates(localSaves);
      });
  }, [loaded]);

  const deleteSaveState = (saveStateId: string) => {
    const nextSaveStates = saveStates.filter((s) => s.id !== saveStateId);
    localStorage.setItem(SAVE_KEY, JSON.stringify(nextSaveStates));
    try {
      const lastSave = JSON.parse(localStorage.getItem(LAST_SAVE_KEY) ?? "null") as SaveState | null;
      if (lastSave && !nextSaveStates.some((s) => s.id === lastSave.id)) {
        localStorage.removeItem(LAST_SAVE_KEY);
      }
    } catch {
      localStorage.removeItem(LAST_SAVE_KEY);
    }
    setSaveStates(nextSaveStates);
  };

  const startNewGame = () => {
    localStorage.removeItem(LAST_SAVE_KEY);
    window.location.href = "/";
  };

  if (!loaded) return null;

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-white" style={{ background: "#050505" }}>
      {/* Header */}
      <header
        className="relative flex-none h-14 flex items-center px-4 gap-3 border-b border-white/[0.08] z-40"
        style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* Left nav */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[0.65rem] font-bold font-cinzel uppercase tracking-wide text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="size-3" />
            Szene
          </Link>
        </div>

        {/* Center logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          <div className="w-12 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5))" }} />
          <div className="w-1.5 h-1.5 rotate-45" style={{ background: GOLD, opacity: 0.7 }} />
          <img src="/logo-eagle.png" width={22} height={22} alt="Falkenwacht" className="object-contain opacity-90" />
          <h1 className="text-sm font-bold tracking-widest font-cinzel" style={{ color: GOLD }}>
            Falkenwacht
          </h1>
          <div className="w-1.5 h-1.5 rotate-45" style={{ background: GOLD, opacity: 0.7 }} />
          <div className="w-12 h-px" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.5), transparent)" }} />
        </div>

        {/* Right: account */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={accountRef}>
            <button
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors hover:bg-white/5"
              onClick={() => setIsAccountOpen((o) => !o)}
              style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)" }}
              type="button"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold font-cinzel"
                style={{ background: "rgba(212,175,55,0.25)", color: GOLD }}
              >
                {username ? username[0].toUpperCase() : "?"}
              </div>
              <div className="text-left">
                <p className="text-[0.55rem] font-cinzel uppercase tracking-wide leading-none" style={{ color: GOLD_DIM }}>
                  Spieler
                </p>
                <p className="text-[0.65rem] font-bold text-slate-100 leading-none mt-0.5 max-w-[100px] truncate">
                  {username ?? "Abenteurer"}
                </p>
              </div>
              <ChevronDown className="size-3 text-slate-500" />
            </button>

            {isAccountOpen && (
              <div
                className="absolute right-0 top-10 z-50 w-64 rounded-lg shadow-2xl"
                style={{ background: "rgba(8,8,8,0.98)", border: "1px solid rgba(212,175,55,0.2)", backdropFilter: "blur(20px)" }}
              >
                <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold font-cinzel shrink-0"
                      style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", color: GOLD }}
                    >
                      {username ? username[0].toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-100 truncate">{username ?? "-"}</p>
                      <p className="text-[0.6rem] font-cinzel uppercase tracking-wide mt-0.5" style={{ color: "rgba(212,175,55,0.6)" }}>
                        Spieler #{userId ?? "..."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <Link
                    href="/"
                    className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setIsAccountOpen(false)}
                  >
                    <Swords className="size-4" />
                    Zur Szene
                  </Link>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-colors mt-1"
                    onClick={logout}
                    style={{ color: "#fca5a5" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    type="button"
                  >
                    <LogIn className="size-4 rotate-180" />
                    Abmelden
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-6">

          {/* Page title */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.3), transparent)" }} />
            <div>
              <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.25em] text-center" style={{ color: GOLD_DIM }}>
                Kampagnenportal
              </p>
              <h1 className="text-2xl font-bold font-cinzel text-center mt-0.5" style={{ color: GOLD }}>
                Falkenwacht
              </h1>
            </div>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3))" }} />
          </div>

          {/* Campaign card */}
          <section
            className="rounded-lg p-5 shadow-2xl"
            style={{ background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)", backdropFilter: "blur(8px)" }}
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em]" style={{ color: GOLD_DIM }}>
                  Aktuelle Kampagne
                </p>
                <h2 className="mt-1 text-xl font-bold font-cinzel" style={{ color: GOLD }}>
                  Die Korruption der Greifenstadt
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                  Krähenloch-Außenlager und Stadt unter der Unterstadt sind keine eigenen Kampagnen, sondern spätere Abschnitte dieser Kampagne.
                </p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold font-cinzel uppercase tracking-wide transition-all shrink-0"
                style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.4)", color: GOLD }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.25)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.15)")}
                onClick={startNewGame}
                type="button"
              >
                <Play className="size-4" />
                Neues Spiel
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {sessions.map((session) => (
                <article
                  key={session.title}
                  className="rounded-md p-4"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)" }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <BookOpen className="mt-1 size-4 shrink-0" style={{ color: GOLD }} />
                    <span
                      className="rounded px-2 py-0.5 text-[0.6rem] font-bold font-cinzel uppercase tracking-wide"
                      style={{
                        background: session.status === "Aktiv" ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.05)",
                        border: session.status === "Aktiv" ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(255,255,255,0.1)",
                        color: session.status === "Aktiv" ? GOLD : "#94a3b8",
                      }}
                    >
                      {session.status}
                    </span>
                  </div>
                  <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.18em]" style={{ color: GOLD_DIM }}>
                    {session.title}
                  </p>
                  <h3 className="mt-1 text-base font-bold font-cinzel text-slate-100">{session.subtitle}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{session.description}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Save slots */}
          <section
            className="rounded-lg p-5 shadow-2xl"
            style={{ background: "rgba(10,8,5,0.85)", border: "1px solid rgba(212,175,55,0.18)", backdropFilter: "blur(8px)" }}
          >
            <div className="mb-5">
              <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.2em]" style={{ color: GOLD_DIM }}>
                Automatische Speicherstände
              </p>
              <h2 className="mt-1 text-xl font-bold font-cinzel" style={{ color: GOLD }}>
                Offene Spielstände
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Jede Entscheidung legt automatisch einen lokalen Speicherstand an. Max. {MAX_ACCOUNT_SAVES} pro Account, {MAX_CAMPAIGN_SAVES} pro Kampagne.
              </p>
            </div>

            {saveStates.length > 0 ? (
              <div className="grid gap-3">
                {saveStates.map((saveState) => {
                  const character = characters[saveState.characterId];
                  const dateLabel = new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(saveState.createdAt));

                  return (
                    <article
                      key={saveState.id}
                      className="rounded-md p-4"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.1)" }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xs font-bold font-cinzel"
                            style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)", color: GOLD }}
                          >
                            {character.name[0]}
                          </div>
                          <div>
                            <p className="text-[0.6rem] font-cinzel uppercase tracking-[0.16em]" style={{ color: GOLD_DIM }}>
                              {saveState.sessionTitle}
                            </p>
                            <h3 className="mt-0.5 text-sm font-bold text-slate-100">{saveState.sceneTitle}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {saveState.choiceLabel} · {character.name}
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                              <Clock3 className="size-3" />
                              {dateLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-bold font-cinzel uppercase tracking-wide transition-all"
                            style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: GOLD }}
                            href={`/?scene=${saveState.sceneId}&character=${saveState.characterId}`}
                          >
                            <Save className="size-3.5" />
                            Laden
                          </Link>
                          <button
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all text-slate-400 hover:text-red-300"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                            }}
                            onClick={() => deleteSaveState(saveState.id)}
                            type="button"
                          >
                            <Trash2 className="size-3.5" />
                            Löschen
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-md p-6 text-center"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <ScrollText className="mx-auto mb-3 size-6 opacity-30" style={{ color: GOLD }} />
                <h3 className="text-base font-bold font-cinzel text-slate-300">Kein Spielstand vorhanden</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Starte die Kampagne, wähle einen Charakter und triff eine Entscheidung.
                </p>
                <button
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-bold font-cinzel uppercase tracking-wide transition-all"
                  style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: GOLD }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.22)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.12)")}
                  onClick={startNewGame}
                  type="button"
                >
                  <Sparkles className="size-3.5" />
                  Neues Spiel starten
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
