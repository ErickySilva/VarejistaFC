"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Ribbon } from "../ui/badge";
import { Button, ButtonLink } from "../ui/button";
import { CountUp } from "../ui/count-up";
import { PlayerAvatar } from "../ui/player-avatar";
import { PageTransition } from "../ui/transitions";
import { ShareCardPanel } from "./share-card-panel";
import type { AwardWinner, CeremonyNight } from "./types";

interface CeremonyProps {
  night: CeremonyNight;
  winners: AwardWinner[];
}

// Roteiro de cada momento, em milissegundos. O prêmio principal (Craque da
// Noite) segura o suspense por mais tempo.
const INTRO_MS = 2800;
const TIMING = {
  regular: { hold: 1500, total: 6400 },
  main: { hold: 2300, total: 7800 },
};

function timingFor(winner: AwardWinner) {
  return winner.award === "mvp" ? TIMING.main : TIMING.regular;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const after = (ms: number) =>
  ({ animationDelay: `${ms}ms` }) as React.CSSProperties;

// Um prêmio sendo revelado, como em uma transmissão: primeiro a faixa com o
// nome do prêmio e o retrato em silhueta; depois a luz abre, o retrato se
// revela, e entram o número da camisa ao fundo, o nome e os números.
function Reveal({ winner }: { winner: AwardWinner }) {
  const isMain = winner.award === "mvp";
  const { hold } = timingFor(winner);

  return (
    <div className="relative flex flex-col items-center text-center">
      <div
        aria-hidden="true"
        className="animate-spot pointer-events-none absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(180_199_230/0.3),transparent)]"
        style={after(hold - 100)}
      />
      <span
        aria-hidden="true"
        className="numeral text-ink-800 animate-fade pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 text-[17rem] leading-none select-none"
        style={after(hold + 150)}
      >
        {winner.shirtNumber}
      </span>

      <Ribbon className="animate-stamp relative h-9! px-6! text-sm! tracking-[0.08em]">
        {winner.label.toUpperCase()}
      </Ribbon>

      <div className="animate-fade relative mt-6" style={after(250)}>
        <div className="animate-unveil" style={after(hold)}>
          <PlayerAvatar
            name={winner.name}
            shirtNumber={winner.shirtNumber}
            photoUrl={winner.photoUrl}
            size="hero"
            ring="crest"
            priority
            className={isMain ? "h-72!" : "h-56!"}
          />
        </div>
      </div>

      <h2
        className={`display animate-rise relative mt-5 ${
          isMain ? "text-7xl" : "text-6xl"
        }`}
        style={after(hold + 450)}
      >
        {winner.name}
      </h2>

      <p
        className="animate-rise relative mt-3 flex items-baseline gap-2"
        style={after(hold + 800)}
      >
        <span className="numeral text-accent text-6xl">
          {winner.countTo === undefined ? (
            winner.value
          ) : (
            <CountUp value={winner.countTo} delayMs={hold + 800} />
          )}
        </span>
        <span className="text-soft text-base font-medium">{winner.unit}</span>
      </p>

      {winner.stats.length > 0 && (
        <dl
          className="animate-fade relative mt-5 flex gap-6"
          style={after(hold + 1300)}
        >
          {winner.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="text-muted text-xs">{stat.label}</dt>
              <dd className="numeral text-2xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Quadro final, em composição de pôster: os premiados lado a lado e o card de
// quem estiver escolhido, pronto para postar.
function Poster({
  night,
  winners,
  canReplay,
  onReplay,
}: {
  night: CeremonyNight;
  winners: AwardWinner[];
  canReplay: boolean;
  onReplay: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const winner = winners[selected];
  const order = (index: number) => ({ "--i": index }) as React.CSSProperties;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-4 py-7">
      <header className="animate-rise flex items-center gap-3">
        <Image
          src="/brand/crest-mark.webp"
          alt=""
          width={112}
          height={117}
          className="h-14 w-auto"
        />
        <div>
          <h1 className="display text-3xl">Premiação da noite</h1>
          <p className="text-muted text-sm tabular-nums">
            Gameplay de {night.date}, {night.score.wins}V {night.score.draws}E{" "}
            {night.score.losses}D, gols {night.score.goalsFor}:
            {night.score.goalsAgainst}
          </p>
        </div>
      </header>

      {winners.length === 0 ? (
        <p className="text-soft text-sm">Esta gameplay não teve premiados.</p>
      ) : (
        <>
          <ul
            aria-label="Premiados. Toque em um para escolher o card."
            className={`grid gap-x-2 gap-y-5 ${
              winners.length === 3 ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            {winners.map((entry, index) => (
              <li key={`${entry.award}:${entry.name}`}>
                <button
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                  className="group animate-rise stagger flex w-full flex-col items-center rounded-lg pb-1 text-center"
                  style={order(index + 1)}
                >
                  <PlayerAvatar
                    name={entry.name}
                    shirtNumber={entry.shirtNumber}
                    photoUrl={entry.photoUrl}
                    size="lg"
                    ring={index === selected ? "accent" : "crest"}
                    className="ease-out-quint h-auto! w-full max-w-28 transition-transform duration-200 group-active:scale-95"
                  />
                  <span className="text-accent mt-2 text-xs font-bold">
                    {entry.label}
                  </span>
                  <span className="display max-w-full truncate text-xl">
                    {entry.name}
                  </span>
                  <span className="text-soft text-xs">
                    <span className="numeral text-fg text-base">
                      {entry.value}
                    </span>{" "}
                    {entry.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div
            className="border-line/50 animate-rise stagger border-t pt-5"
            style={order(winners.length + 2)}
          >
            <ShareCardPanel winner={winner} nightDate={night.date} />
          </div>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <ButtonLink href="/" size="lg">
          Continuar
        </ButtonLink>
        {winners.length > 0 && canReplay && (
          <Button variant="ghost" onClick={onReplay}>
            Rever a premiação
          </Button>
        )}
      </div>
    </div>
  );
}

// Cerimônia de premiação da noite, depois de encerrar a gameplay. A tela fica
// escura e os prêmios são revelados um a um, na ordem: Artilheiro, Assistente,
// Craque da Noite e, se houve Rush, Destaque do Rush. Avança sozinha, com
// toque ou pelo teclado; dá para pular para o quadro final. Com "reduzir
// movimento" ligado, vai direto para o quadro final.
export function Ceremony({ night, winners }: CeremonyProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  // -1: abertura. 0..n-1: um prêmio por vez. n: quadro final.
  const [position, setPosition] = useState(-1);

  const last = winners.length;
  const stage = reducedMotion ? last : position;
  const finished = stage >= last;
  const winner = stage >= 0 && !finished ? winners[stage] : null;
  const duration = winner ? timingFor(winner).total : INTRO_MS;

  useEffect(() => {
    if (finished) return;
    const timer = setTimeout(
      () => setPosition((current) => Math.min(current + 1, last)),
      duration,
    );
    return () => clearTimeout(timer);
  }, [stage, finished, last, duration]);

  const next = () => setPosition((current) => Math.min(current + 1, last));

  if (finished) {
    return (
      <PageTransition>
        <main className="bg-ink-950 flex flex-1 flex-col">
          <Poster
            night={night}
            winners={winners}
            canReplay={!reducedMotion}
            onReplay={() => setPosition(-1)}
          />
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="bg-ink-950 relative flex flex-1 flex-col overflow-hidden">
        {/* Progresso, como nos stories: um traço por momento. */}
        <div aria-hidden="true" className="flex gap-1.5 px-4 pt-4">
          {Array.from({ length: last + 1 }, (_, index) => (
            <span
              key={index}
              className="bg-line/60 h-1 flex-1 overflow-hidden rounded-full"
            >
              {index - 1 < stage && (
                <span className="bg-paper block h-full rounded-full" />
              )}
              {index - 1 === stage && (
                <span
                  key={stage}
                  className="bg-paper block h-full origin-left rounded-full"
                  style={{ animation: `grow ${duration}ms linear both` }}
                />
              )}
            </span>
          ))}
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8">
          {/* Toque em qualquer lugar avança; o botão cobre teclado e leitor. */}
          <button
            type="button"
            onClick={next}
            className="absolute inset-0 cursor-pointer focus-visible:outline-none"
            aria-label={winner ? "Próximo prêmio" : "Começar a premiação"}
          />
          <div key={stage} aria-live="polite" className="pointer-events-none">
            {winner ? (
              <Reveal winner={winner} />
            ) : (
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/brand/crest-mark.webp"
                  alt=""
                  width={160}
                  height={167}
                  priority
                  className="animate-stamp h-28 w-auto"
                />
                <p
                  className="text-accent animate-rise mt-6 text-xs font-bold tracking-[0.14em]"
                  style={after(350)}
                >
                  GAMEPLAY ENCERRADA
                </p>
                <h1
                  className="display animate-rise mt-2 text-5xl"
                  style={after(550)}
                >
                  Premiação
                  <br />
                  da noite
                </h1>
                <p
                  className="text-muted animate-fade mt-3 text-sm"
                  style={after(1100)}
                >
                  Gameplay de {night.date}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pb-safe relative flex justify-center px-4">
          <Button variant="ghost" onClick={() => setPosition(last)}>
            Pular para o resultado
          </Button>
        </div>
      </main>
    </PageTransition>
  );
}
