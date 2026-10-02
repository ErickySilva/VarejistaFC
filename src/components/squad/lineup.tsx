import Link from "next/link";
import { LinkPending } from "../ui/link-pending";
import { PlayerAvatar } from "../ui/player-avatar";
import { FORWARD } from "../ui/transitions";

export interface LineupPlayer {
  slug: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
}

interface LineupProps {
  players: LineupPlayer[];
  // Parâmetros a manter no link do perfil (ex.: o período).
  query?: string;
}

// A escalação do clube: os jogadores lado a lado, do mesmo tamanho e na ordem
// do número da camisa. Não é ranking; é quem é o time. Tocar em um retrato
// abre o perfil, e o retrato viaja até lá.
export function Lineup({ players, query }: LineupProps) {
  return (
    <ul className="grid grid-cols-4 gap-2 sm:gap-5">
      {players.map((player, index) => (
        <li key={player.slug}>
          <Link
            href={`/jogadores/${player.slug}${query ? `?${query}` : ""}`}
            transitionTypes={FORWARD}
            className="group animate-rise stagger flex flex-col items-center text-center"
            style={{ "--i": index + 1 } as React.CSSProperties}
          >
            <LinkPending />
            <PlayerAvatar
              name={player.name}
              shirtNumber={player.shirtNumber}
              photoUrl={player.photoUrl}
              size="lg"
              ring="crest"
              priority
              sharedAs={player.slug}
              className="ease-out-quint h-auto! w-full max-w-32 transition-transform duration-200 group-hover:-translate-y-1 group-active:scale-95 group-has-[[data-pending=true]]:scale-95"
            />
            <span className="mt-2 max-w-full truncate text-sm font-bold sm:text-base">
              {player.name}
            </span>
            <span className="numeral text-muted text-xs">
              <span className="sr-only">camisa </span>
              {player.shirtNumber}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
