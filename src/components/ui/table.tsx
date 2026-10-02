// Tabela de números: para comparar várias colunas entre poucos jogadores.
// Sem caixa nem grade; só um fio entre as linhas e os números alinhados à
// direita.

export function Table({
  caption,
  children,
}: {
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line/40 relative overflow-x-auto border-b">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

interface CellProps {
  children?: React.ReactNode;
  align?: "left" | "right";
  title?: string;
}

export function Th({ children, align = "right", title }: CellProps) {
  return (
    <th
      scope="col"
      className={`text-muted py-2 text-xs font-medium whitespace-nowrap ${
        align === "left" ? "pr-2 text-left" : "pl-3 text-right"
      }`}
    >
      {title ? (
        <abbr title={title} className="no-underline">
          {children}
        </abbr>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  children,
  align = "right",
  strong = false,
}: CellProps & { strong?: boolean }) {
  return (
    <td
      className={`py-2.5 whitespace-nowrap ${
        align === "left" ? "pr-2 text-left" : "pl-3 text-right tabular-nums"
      } ${strong ? "text-fg font-bold" : align === "left" ? "" : "text-soft"}`}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-line/40 border-t">{children}</tr>;
}
