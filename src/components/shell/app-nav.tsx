"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import {
  HomeIcon,
  MatchesIcon,
  PersonIcon,
  RankingIcon,
  WhistleIcon,
} from "../ui/icons";
import { PlayerAvatar } from "../ui/player-avatar";

export interface NavUser {
  name: string;
  // Jogador vinculado à conta, se houver.
  player: {
    href: string;
    photoUrl: string | null;
  } | null;
}

interface AppNavProps {
  user: NavUser | null;
  // Pode operar a gameplay (admin).
  canManageGameplay: boolean;
  // Pode gerenciar contas (admin).
  canManageAccounts: boolean;
  // Há uma gameplay em andamento.
  live: boolean;
}

// Telas de tela cheia, sem navegação: a entrada do clube e a premiação.
const IMMERSIVE = ["/entrar", "/login", "/premiacao"];

function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`bg-accent animate-live inline-block h-2 w-2 rounded-full ${className}`}
    />
  );
}

// Navegação do app: barra superior em todas as larguras e, no celular, barra
// inferior ao alcance do polegar. Quem pode operar a gameplay tem o atalho no
// centro da barra inferior.
export function AppNav({
  user,
  canManageGameplay,
  canManageAccounts,
  live,
}: AppNavProps) {
  const pathname = usePathname();
  if (IMMERSIVE.some((prefix) => pathname.startsWith(prefix))) return null;
  // No registro de partida a barra inferior dá lugar aos botões da etapa.
  const focused = pathname.startsWith("/gameplay/partida");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const main = [
    { href: "/", label: "Início", Icon: HomeIcon },
    { href: "/ranking", label: "Ranking", Icon: RankingIcon },
    { href: "/partidas", label: "Partidas", Icon: MatchesIcon },
  ];
  const personal = user
    ? {
        href: user.player?.href ?? "/conta",
        label: user.player ? "Perfil" : "Conta",
      }
    : { href: "/entrar", label: "Entrar" };

  const topLink = (active: boolean) =>
    `relative flex h-14 items-center px-3 text-sm font-medium transition-colors ${
      active ? "text-fg" : "text-muted hover:text-fg"
    }`;

  const bottomItem = (active: boolean) =>
    `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-[color,transform] active:scale-95 ${
      active ? "text-accent" : "text-muted"
    }`;
  // Marcador da seção ativa. É o mesmo elemento em qualquer item, então ele
  // desliza de um para o outro quando a seção muda.
  const marker = (
    <ViewTransition name="nav-marker" share="slide" default="none">
      <span
        aria-hidden="true"
        className="bg-accent absolute top-0 h-0.5 w-8 rounded-full"
      />
    </ViewTransition>
  );

  return (
    <>
      <header className="bg-bg/95 border-line/50 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          <Link
            href="/"
            className="mr-2 flex items-center gap-2.5 font-extrabold tracking-tight"
          >
            <Image
              src="/brand/crest-mark.webp"
              alt=""
              width={72}
              height={75}
              className="h-9 w-auto"
            />
            Varejista FC
          </Link>

          <nav aria-label="Principal" className="hidden md:flex">
            {main.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={topLink(active)}
                >
                  {label}
                  {href === "/" && live && <LiveDot className="ml-1.5" />}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="bg-accent absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {canManageGameplay && (
              <Link
                href="/gameplay"
                aria-current={isActive("/gameplay") ? "page" : undefined}
                className={`hidden h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors md:flex ${
                  live
                    ? "bg-accent text-accent-ink hover:bg-accent-deep"
                    : "bg-raised text-fg hover:bg-line"
                }`}
              >
                <WhistleIcon className="h-4 w-4" />
                {live ? "Gameplay ao vivo" : "Gameplay"}
              </Link>
            )}
            {canManageAccounts && (
              <Link
                href="/admin"
                aria-current={isActive("/admin") ? "page" : undefined}
                className={`${topLink(isActive("/admin"))} hidden md:flex`}
              >
                Admin
              </Link>
            )}
            {user ? (
              <Link
                href="/conta"
                aria-label={`Conta de ${user.name}`}
                className="hover:bg-surface flex h-11 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors"
              >
                {user.player ? (
                  <PlayerAvatar
                    name={user.name}
                    photoUrl={user.player.photoUrl}
                    size="xs"
                    ring="crest"
                  />
                ) : (
                  <PersonIcon />
                )}
                <span className="hidden sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                href="/entrar"
                className="bg-raised hover:bg-line flex h-9 items-center rounded-md px-3 text-sm font-semibold transition-colors"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav
        aria-label="Principal"
        hidden={focused}
        className="bg-surface border-line/60 pb-safe shadow-float fixed inset-x-0 bottom-0 z-30 border-t md:hidden"
      >
        <div className="mx-auto flex max-w-md items-end px-2">
          {main.slice(0, 2).map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={bottomItem(active)}
              >
                {active && marker}
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {href === "/" && live && !canManageGameplay && (
                    <LiveDot className="absolute -top-0.5 -right-1.5" />
                  )}
                </span>
                {label}
              </Link>
            );
          })}

          {canManageGameplay && (
            <Link
              href="/gameplay"
              aria-current={isActive("/gameplay") ? "page" : undefined}
              className="text-fg flex min-h-14 flex-1 flex-col items-center justify-end gap-1 pb-2 text-[0.7rem] font-semibold"
            >
              <span className="relative -mt-5">
                <span className="clip-hex bg-accent text-accent-ink flex h-13 w-12 items-center justify-center transition-transform active:scale-95">
                  <WhistleIcon className="h-6 w-6" />
                </span>
                {live && (
                  <span className="bg-surface absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full">
                    <LiveDot />
                  </span>
                )}
              </span>
              {live ? "Ao vivo" : "Gameplay"}
            </Link>
          )}

          <Link
            href="/partidas"
            aria-current={isActive("/partidas") ? "page" : undefined}
            className={bottomItem(isActive("/partidas"))}
          >
            {isActive("/partidas") && marker}
            <MatchesIcon className="h-6 w-6" />
            Partidas
          </Link>
          <Link
            href={personal.href}
            aria-current={pathname === personal.href ? "page" : undefined}
            className={bottomItem(pathname === personal.href)}
          >
            {pathname === personal.href && marker}
            <PersonIcon className="h-6 w-6" />
            {personal.label}
          </Link>
        </div>
      </nav>
    </>
  );
}
