"use client";

import Link, { useLinkStatus } from "next/link";
import type { EntryPlayer } from "@/server/players/entry";
import { Ribbon } from "../ui/badge";
import { PlayerAvatar } from "../ui/player-avatar";
import { FORWARD } from "../ui/transitions";

interface PlayerTilesProps {
  players: EntryPlayer[];
  // "admin" leva à área administrativa depois da senha.
  destination?: "admin";
}

// Marca o tile tocado enquanto a tela de senha carrega: ele fica em evidência
// e os outros recuam (a lista reage a este marcador pelo CSS).
function Chosen() {
  const { pending } = useLinkStatus();
  return <span hidden data-chosen={pending} />;
}

// Escolha do jogador na entrada: cada um aparece emoldurado como o grifo do
// escudo, com o número na faixa. Os tiles entram em cascata; ao tocar, o
// retrato escolhido viaja até a tela de senha.
export function PlayerTiles({ players, destination }: PlayerTilesProps) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 [&>li]:transition-opacity [&>li]:duration-200 has-[[data-chosen=true]]:[&>li:not(:has([data-chosen=true]))]:opacity-35">
      {players.map((player, index) => {
        const content = (
          <>
            <PlayerAvatar
              name={player.name}
              shirtNumber={player.shirtNumber}
              photoUrl={player.photoUrl}
              size="xl"
              ring="crest"
              priority
              sharedAs={player.slug}
              className="ease-out-quint h-auto! w-full max-w-40 transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-1 group-active:scale-95"
            />
            <Ribbon className="relative -mt-4 h-7! px-4! text-sm!">
              <span className="sr-only">Camisa </span>
              {player.shirtNumber}
            </Ribbon>
            <span className="display mt-2 text-xl">{player.name}</span>
          </>
        );
        const tileClass =
          "group animate-rise stagger flex flex-col items-center rounded-lg text-center";
        const style = { "--i": index + 2 } as React.CSSProperties;

        return (
          <li key={player.slug}>
            {player.hasAccount ? (
              <Link
                href={`/entrar/${player.slug}${destination ? `?destino=${destination}` : ""}`}
                transitionTypes={FORWARD}
                className={tileClass}
                style={style}
              >
                <Chosen />
                {content}
              </Link>
            ) : (
              <div className={`${tileClass} opacity-55`} style={style}>
                {content}
                <span className="text-muted text-xs">
                  Conta ainda não criada
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
