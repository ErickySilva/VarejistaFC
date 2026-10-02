"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

export interface TabOption {
  href: string;
  label: string;
  current: boolean;
}

interface LinkTabsProps {
  label: string;
  options: TabOption[];
  // "pills": abas principais. "quiet": seletor secundário (ex.: período).
  variant?: "pills" | "quiet";
}

// Enquanto a aba tocada carrega, o rótulo pulsa: retorno imediato sem trocar a
// tela por um esqueleto.
function TabLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : ""}>{children}</span>;
}

// Abas que são links: o estado fica na URL, então dá para compartilhar e
// voltar. No celular a fileira rola na horizontal, sem quebrar em linhas.
export function LinkTabs({ label, options, variant = "pills" }: LinkTabsProps) {
  const pills = variant === "pills";
  const currentHref = options.find((option) => option.current)?.href;
  const currentRef = useRef<HTMLLIElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // No celular a fileira pode ser mais larga que a tela: a aba ativa vem para
  // a vista quando muda.
  useEffect(() => {
    const item = currentRef.current;
    const row = navRef.current;
    if (!item || !row) return;
    // Rola só a fileira, na horizontal; a página não se mexe.
    row.scrollTo({
      left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [currentHref]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className="relative -mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul
        className={
          pills
            ? "bg-surface inline-flex gap-1 rounded-lg p-1"
            : "inline-flex gap-5"
        }
      >
        {options.map((option) => (
          <li key={option.href} ref={option.current ? currentRef : undefined}>
            <Link
              href={option.href}
              aria-current={option.current ? "page" : undefined}
              scroll={false}
              className={
                pills
                  ? `flex min-h-10 items-center rounded-md px-3.5 text-sm font-semibold whitespace-nowrap transition-[color,background-color,transform] duration-200 active:scale-95 ${
                      option.current
                        ? "bg-accent text-accent-ink"
                        : "text-soft hover:text-fg"
                    }`
                  : `flex min-h-10 items-center border-b-2 text-sm whitespace-nowrap transition-colors duration-200 ${
                      option.current
                        ? "border-accent text-fg font-semibold"
                        : "text-muted hover:text-fg border-transparent"
                    }`
              }
            >
              <TabLabel>{option.label}</TabLabel>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
