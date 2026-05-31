"use client";

import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Trash2,
  Play,
  Save,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { characters, type CharacterId } from "@/data/scenes";

const SAVE_KEY = "falkenwacht.saveStates";
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
  const [saveStates, setSaveStates] = useState<SaveState[]>([]);

  useEffect(() => {
    try {
      setSaveStates(JSON.parse(localStorage.getItem(SAVE_KEY) ?? "[]"));
    } catch {
      setSaveStates([]);
    }
  }, []);

  const deleteSaveState = (saveStateId: string) => {
    const nextSaveStates = saveStates.filter(
      (saveState) => saveState.id !== saveStateId,
    );

    localStorage.setItem(SAVE_KEY, JSON.stringify(nextSaveStates));
    setSaveStates(nextSaveStates);
  };

  return (
    <main className="min-h-screen px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
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
          <div className="flex items-center gap-2 rounded-md border border-ember-400/30 bg-ink-950/70 px-3 py-2 shadow-glow">
            <ShieldCheck className="size-4 text-ember-400" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                Spielerbereich
              </p>
              <p className="text-xs font-semibold text-slate-100">
                Kampagne & Speicherstände
              </p>
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
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
              href="/"
            >
              <Play className="size-4" />
              Kampagne starten
            </Link>
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
              <Link
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                href="/"
              >
                <Sparkles className="size-4" />
                Zur Kampagne
              </Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
