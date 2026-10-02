import { plural } from "@/lib/format";
import { DrawIcon, LossIcon, WinIcon } from "./icons";

interface RecordBarProps {
  wins: number;
  draws: number;
  losses: number;
}

// Campanha em uma barra: a fatia de vitórias, empates e derrotas. A legenda
// repete os números com ícone e palavra, então a cor não é a única pista.
export function RecordBar({ wins, draws, losses }: RecordBarProps) {
  const total = wins + draws + losses;
  if (total === 0) return null;

  const segments = [
    { key: "wins", count: wins, bar: "bg-win" },
    { key: "draws", count: draws, bar: "bg-draw" },
    { key: "losses", count: losses, bar: "bg-loss" },
  ].filter((segment) => segment.count > 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div
        aria-hidden="true"
        className="animate-grow flex h-2.5 origin-left gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={`h-full ${segment.bar}`}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li className="flex items-center gap-1.5">
          <WinIcon className="text-win h-4 w-4" />
          {plural(wins, "vitória", "vitórias")}
        </li>
        <li className="flex items-center gap-1.5">
          <DrawIcon className="text-draw h-4 w-4" />
          {plural(draws, "empate", "empates")}
        </li>
        <li className="flex items-center gap-1.5">
          <LossIcon className="text-loss h-4 w-4" />
          {plural(losses, "derrota", "derrotas")}
        </li>
      </ul>
    </div>
  );
}
