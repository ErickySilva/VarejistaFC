import { ViewTransition } from "react";

// Transições entre telas. Tudo aqui responde a uma navegação: a tela que sai
// e a que entra se cruzam, e a direção acompanha o caminho (para dentro de um
// detalhe ou de volta). O desenho de cada uma está em globals.css.

// Tipos de navegação, para o `transitionTypes` dos links.
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

const BY_TYPE = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "page",
};

// Envolve o conteúdo de uma página. Atualizações de dados na mesma página
// (trocar de aba, recarregar) não passam por aqui: cada parte cuida da sua.
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}

// Item de uma lista que pode mudar de posição (ranking) ou chegar depois
// (partida nova na gameplay aberta). Só anima quando os dados mudam.
export function ListItemTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransition update="reorder" enter="arrive" default="none">
      {children}
    </ViewTransition>
  );
}
