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
    const nextSaveStates = saveStates.filter(
      (saveState) => saveState.id !== saveStateId,
    );

    localStorage.setItem(SAVE_KEY, JSON.stringify(nextSaveStates));

    try {
      const lastSaveState = JSON.parse(
        localStorage.getItem(LAST_SAVE_KEY) ?? "null",
      ) as SaveState | null;
      const lastSaveStillExists =
        lastSaveState &&
        nextSaveStates.some((saveState) => saveState.id === lastSaveState.id);

      if (!lastSaveStillExists) {
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
    <main className="min-h-screen overflow-y-auto px-4 py-5 text-slate-50 sm:px-6 lg:px-8" style={{maxHeight: '100dvh'}}>
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-ember-300"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Zurück zur Szene
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-ember-400">
              Main-Bereich
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Kampagnenportal
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={accountRef}>
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-white/5"
                onClick={() => setIsAccountOpen((o) => !o)}
                style={{background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)'}}
                type="button"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-cinzel shrink-0" style={{background: 'rgba(212,175,55,0.2)', color: '#d4af37'}}>
                  {username ? username[0].toUpperCase() : "?"}
                </div>
                <div className="text-left">
                  <p className="text-[0.55rem] font-cinzel uppercase tracking-wide leading-none" style={{color: 'rgba(212,175,55,0.7)'}}>Eingeloggt als</p>
                  <p className="text-xs font-bold text-slate-100 leading-none mt-0.5 max-w-[140px] truncate">{username ?? "Abenteurer"}</p>
                </div>
                <ChevronDown className="size-3 text-slate-500" />
              </button>
              {isAccountOpen ? (
                <div className="absolute right-0 top-12 z-50 w-64 rounded-lg shadow-2xl" style={{background: 'rgba(8,8,8,0.98)', border: '1px solid rgba(212,175,55,0.2)', backdropFilter: 'blur(20px)'}}>
                  <div className="p-4 border-b" style={{borderColor: 'rgba(255,255,255,0.08)'}}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-cinzel shrink-0" style={{background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37'}}>
                        {username ? username[0].toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-100 truncate">{username ?? "-"}</p>
                        <p className="text-[0.6rem] font-cinzel uppercase tracking-wide mt-1" style={{color: 'rgba(212,175,55,0.6)'}}>
                          Spieler #{userId ?? "..."}
                        </p>
                        <p className="text-[0.6rem] text-slate-500 mt-0.5">Falkenwacht Account</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                      href="/"
                      onClick={() => setIsAccountOpen(false)}
                    >
                      <Swords className="size-4" />
                      Zur Szene
                    </Link>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-colors mt-1"
                      onClick={logout}
                      style={{color: '#fca5a5'}}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      type="button"
                    >
                      <LogIn className="size-4 rotate-180" />
                      Abmelden
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="rounded-md border border-white/10 bg-ink-950/75 p-4 shadow-2xl">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-ember-300">
                Aktuelle Kampagne
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                Falkenwacht - Die Korruption der Greifenstadt
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Krähenloch-Außenlager und Stadt unter der Unterstadt sind keine
                eigenen Kampagnen, sondern spätere Abschnitte dieser Kampagne.
              </p>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
              onClick={startNewGame}
              type="button"
            >
              <Play className="size-4" />
              Neues Spiel starten
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {sessions.map((session) => (
              <article
                className="rounded-md border border-white/10 bg-white/[0.06] p-4"
                key={session.title}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <BookOpen className="mt-1 size-4 text-ember-300" />
                  <span className="rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-xs font-semibold text-slate-200">
                    {session.status}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                  {session.title}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {session.subtitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {session.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-white/10 bg-ink-950/75 p-4 shadow-2xl">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.18em] text-ember-300">
              Automatische Speicherstände
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Offene Spielstände
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Jede Charakterauswahl und jede Szenenentscheidung legt automatisch
              einen lokalen Speicherstand an. Für die spätere PostgreSQL-Logik
              gilt hier bereits: maximal {MAX_ACCOUNT_SAVES} Speicherstände pro
              Account und maximal {MAX_CAMPAIGN_SAVES} pro Kampagne.
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
                    className="rounded-md border border-white/10 bg-white/[0.06] p-4"
                    key={saveState.id}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ember-300">
                          {saveState.sessionTitle}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {saveState.sceneTitle}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          {saveState.choiceLabel} · Hauptcharakter:{" "}
                          {character.name}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                          <Clock3 className="size-3" />
                          {dateLabel}
                        </p>
                      </div>
                      <Link
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
                        href={`/?scene=${saveState.sceneId}&character=${saveState.characterId}`}
                      >
                        <Save className="size-4" />
                        Laden
                      </Link>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-red-400/70 hover:bg-red-500/15"
                        onClick={() => deleteSaveState(saveState.id)}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                        Löschen
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
              <ScrollText className="mb-3 size-5 text-ember-300" />
              <h3 className="text-lg font-semibold">
                Noch kein Speicherstand vorhanden
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Starte die Kampagne, wähle einen Charakter und triff eine
                Entscheidung. Danach erscheint der Speicherstand hier.
              </p>
              <button
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                onClick={startNewGame}
                type="button"
              >
                <Sparkles className="size-4" />
                Neues Spiel starten
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
