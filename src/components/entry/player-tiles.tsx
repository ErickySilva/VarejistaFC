import Link from "next/link";
import type { EntryPlayer } from "@/server/players/entry";
import { PlayerAvatar } from "../ui/player-avatar";

interface PlayerTilesProps {
  players: EntryPlayer[];
  // "admin" leva à área administrativa depois da senha.
  destination?: "admin";
}

// Tiles da tela de entrada: foto, nome e número. Tocar em um jogador leva à
// senha da conta dele.
export function PlayerTiles({ players, destination }: PlayerTilesProps) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {players.map((player) => {
        const content = (
          <>
            <PlayerAvatar
              name={player.name}
              shirtNumber={player.shirtNumber}
              photoUrl={player.photoUrl}
              size="lg"
            />
            <span className="font-semibold">{player.name}</span>
            <span className="text-sm tabular-nums opacity-70">
              #{player.shirtNumber}
            </span>
          </>
        );
        const tileClass =
          "border-foreground/15 flex min-h-44 flex-col items-center justify-center gap-1 rounded border p-3 text-center";

        return (
          <li key={player.slug}>
            {player.hasAccount ? (
              <Link
                href={`/entrar/${player.slug}${destination ? `?destino=${destination}` : ""}`}
                className={tileClass}
              >
                {content}
              </Link>
            ) : (
              <div className={`${tileClass} opacity-60`}>
                {content}
                <span className="text-xs">Conta ainda não criada</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
