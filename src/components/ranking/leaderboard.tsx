import Link from "next/link";
import { CrownIcon } from "../ui/icons";
import { LinkPending } from "../ui/link-pending";
import { PlayerAvatar } from "../ui/player-avatar";
import { FORWARD, ListItemTransition } from "../ui/transitions";

export interface LeaderboardDetail {
  // Abreviação mostrada (ex.: "J") e o nome por extenso.
  label: string;
  title: string;
  value: string | number;
}

export interface LeaderboardEntry {
  id: number;
  // Identificador do jogador na URL, para o retrato viajar até o perfil.
  slug: string;
  href: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  // Valor da métrica principal, pronto para leitura.
  value: string;
  // Lidera o scout da aba: ganha a coroa sobre a foto. Só nas abas de scout
  // (gols, assistências, G/A); o ranking geral não coroa ninguém.
  crowned?: boolean;
  details: LeaderboardDetail[];
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  // Nome da métrica principal (ex.: "G/A").
  metric: string;
  // O retrato da linha é o mesmo do perfil (viaja na navegação). Desligue
  // quando a tela já tem outro retrato do mesmo jogador com esse papel.
  sharePortraits?: boolean;
}

function Details({ details }: { details: LeaderboardDetail[] }) {
  if (details.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
      {details.map((detail) => (
        <div key={detail.label} className="flex items-baseline gap-1">
          <dt className="text-muted">
            <abbr title={detail.title} className="no-underline">
              {detail.label}
            </abbr>
          </dt>
          <dd className="text-soft font-semibold tabular-nums">
            {detail.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Classificação: todos os jogadores com o mesmo tratamento. A ordem e o número
// da posição dizem quem está à frente; ninguém ganha foto maior, painel, selo
// ou barra. Destaque visual fica para os prêmios da noite.
//
// A única marca de liderança é a coroa: um ícone pequeno sobre a foto de quem
// lidera um scout específico. O resto da linha é igual ao das outras.
//
// Quando a ordem muda (outra aba, outro período, dados novos), cada linha
// desliza para a nova posição em vez de a lista piscar.
export function Leaderboard({
  entries,
  metric,
  sharePortraits = true,
}: LeaderboardProps) {
  if (entries.length === 0) return null;

  return (
    <ol className="border-line/40 border-b">
      {entries.map((entry, index) => (
        <ListItemTransition key={entry.id}>
          <li className="border-line/40 border-t">
            <Link
              href={entry.href}
              transitionTypes={FORWARD}
              className="group hover:bg-surface active:bg-surface has-[[data-pending=true]]:bg-surface -mx-2 grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-x-3 rounded-md px-2 py-3.5 transition-colors"
            >
              <LinkPending />
              <span className="numeral text-soft row-span-2 text-center text-2xl">
                <span className="sr-only">Posição </span>
                {index + 1}
              </span>
              <span className="relative row-span-2 flex">
                {entry.crowned && (
                  <span className="text-accent animate-stamp absolute -top-2.5 left-1/2 z-10 -ml-2.5">
                    <CrownIcon />
                    <span className="sr-only">Líder em {metric}. </span>
                  </span>
                )}
                <PlayerAvatar
                  name={entry.name}
                  shirtNumber={entry.shirtNumber}
                  photoUrl={entry.photoUrl}
                  size="md"
                  sharedAs={sharePortraits ? entry.slug : undefined}
                  className="ease-out-quint transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                />
              </span>
              <span className="truncate text-lg font-bold">
                {entry.name}
                <span className="text-muted ml-1.5 text-sm font-normal tabular-nums">
                  <span className="sr-only">camisa </span>
                  {entry.shirtNumber}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="numeral text-2xl">{entry.value}</span>
                <span className="text-muted text-[0.7rem]">{metric}</span>
              </span>
              <span className="col-span-2 pt-1">
                <Details details={entry.details} />
              </span>
            </Link>
          </li>
        </ListItemTransition>
      ))}
    </ol>
  );
}
