"use client";

import {
  BookOpen,
  HeartPulse,
  LogIn,
  MessageCircleQuestion,
  ScrollText,
  ShieldCheck,
  Swords,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  type CharacterId,
  characters,
  initialSceneId,
  scenes,
} from "@/data/scenes";

const findScene = (sceneId: string) =>
  scenes.find((scene) => scene.id === sceneId) ?? scenes[0];

export default function Home() {
  const [currentSceneId, setCurrentSceneId] = useState(initialSceneId);
  const [selectedCharacterId, setSelectedCharacterId] =
    useState<CharacterId | null>(null);

  const currentScene = findScene(currentSceneId);
  const activeCharacter = selectedCharacterId
    ? characters[selectedCharacterId]
    : null;
  const activeNpc =
    selectedCharacterId === "ryu"
      ? characters.ayane
      : selectedCharacterId === "ayane"
        ? characters.ryu
        : null;
  const isCharacterSelection = currentScene.id === "charakterwahl";
  const showCharacterStats = Boolean(activeCharacter) && !isCharacterSelection;

  const stats = [
    {
      label: "HP",
      value: activeCharacter
        ? `${activeCharacter.stats.hp} / ${activeCharacter.stats.hp}`
        : "-",
      icon: HeartPulse,
    },
    {
      label: "AC",
      value: activeCharacter ? String(activeCharacter.stats.ac) : "-",
      icon: Swords,
    },
    { label: "Scene", value: currentScene.chapter, icon: BookOpen },
  ];

  const selectCharacter = (characterId: CharacterId) => {
    setSelectedCharacterId(characterId);
    setCurrentSceneId("prolog-das-gestohlene-ei");
  };

  return (
    <main className="min-h-screen px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ember-400">
              Falkenwacht MVP
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {currentScene.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-ember-400/30 bg-ink-950/70 px-3 py-2 shadow-glow">
              <ShieldCheck className="size-4 text-ember-400" />
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                  Gildenpass
                </p>
                <p className="text-xs font-semibold text-slate-100">
                  Login-System vorbereitet
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
              type="button"
              title="Einloggen spaeter aktivieren"
            >
              <LogIn className="size-4" />
              Login
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md border border-ember-400/50 bg-ember-500 px-3 text-sm font-bold text-ink-950 transition hover:bg-ember-400"
              type="button"
              title="Registrierung spaeter aktivieren"
            >
              <UserPlus className="size-4" />
              Registrieren
            </button>
            <button
              className="grid size-11 place-items-center rounded-md border border-white/15 bg-white/10 text-slate-100 shadow-glow"
              type="button"
              aria-label="AI Hilfe öffnen"
              title="AI Hilfe öffnen"
            >
              <MessageCircleQuestion className="size-5" />
            </button>
          </div>
        </header>

        {showCharacterStats ? (
          <div className="grid grid-cols-3 gap-2 lg:max-w-xl">
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
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <BookOpen className="mb-2 size-4 text-ember-400" />
              <p className="text-xs text-slate-400">Kapitel</p>
              <p className="text-sm font-semibold">{currentScene.chapter}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <ScrollText className="mb-2 size-4 text-ember-400" />
              <p className="text-xs text-slate-400">Ort</p>
              <p className="text-sm font-semibold">{currentScene.location}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <ShieldCheck className="mb-2 size-4 text-ember-400" />
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-semibold">
                {isCharacterSelection ? "Charakter wählen" : "Einführung"}
              </p>
            </div>
          </div>
        )}

        <section className="flex flex-1 flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/70 shadow-2xl">
          <div
            className="flex min-h-[34rem] flex-1 items-end bg-cover bg-center p-4 lg:min-h-[38rem] lg:p-6"
            style={{
              backgroundImage: `linear-gradient(180deg,rgba(17,24,39,0.22),rgba(3,4,10,0.94)),url('${currentScene.imageUrl}')`,
            }}
          >
            {isCharacterSelection ? (
              <div className="grid w-full gap-4 lg:grid-cols-2">
                {(["ryu", "ayane"] as CharacterId[]).map((characterId) => {
                  const character = characters[characterId];

                  return (
                    <button
                      className="group flex min-h-[32rem] flex-col justify-end overflow-hidden rounded-md border border-white/10 bg-ink-950/75 text-left transition hover:border-ember-400/70 hover:bg-ink-950/90"
                      key={character.id}
                      onClick={() => selectCharacter(character.id)}
                      type="button"
                    >
                      <div className="flex min-h-64 items-end justify-center bg-gradient-to-b from-white/5 to-transparent px-3 pt-3">
                        <Image
                          alt={`${character.name} character model`}
                          className="max-h-72 object-contain drop-shadow-2xl transition group-hover:scale-[1.03]"
                          height={420}
                          src={character.modelImageUrl}
                          width={320}
                        />
                      </div>
                      <div className="border-t border-white/10 bg-black/50 p-4">
                        <span className="block text-xl font-semibold">
                          {character.name}
                        </span>
                        <span className="mt-1 block text-sm text-ember-300">
                          Level {character.level} {character.className} |{" "}
                          {character.subclassName}
                        </span>
                        <span className="mt-1 block text-sm text-slate-300">
                          HP {character.stats.hp} | AC {character.stats.ac} |
                          Initiative +{character.stats.initiative}
                        </span>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300">
                          {character.backstory}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <p className="mb-2 inline-flex rounded-sm bg-ember-500 px-2 py-1 text-xs font-bold text-ink-950">
                  {currentScene.speaker}
                </p>
                <p className="max-w-3xl text-balance text-2xl font-semibold leading-snug">
                  {currentScene.narration}
                </p>
                {activeCharacter && activeNpc ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Hauptcharakter: {activeCharacter.name}. Begleitung:{" "}
                    {activeNpc.name}.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {!isCharacterSelection ? (
            <div className="space-y-2 border-t border-white/10 bg-ink-950/95 p-3">
              {currentScene.choices.map((choice) => (
                <button
                  className="w-full rounded-md border border-white/10 bg-white/[0.06] px-3 py-3 text-left text-sm text-slate-100 transition hover:border-ember-400/70 hover:bg-ember-500/15"
                  key={choice.id}
                  onClick={() => setCurrentSceneId(choice.nextSceneId)}
                  type="button"
                >
                  <span className="block font-semibold">{choice.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                    {choice.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
