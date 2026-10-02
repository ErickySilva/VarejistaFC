// Estatística: o número é o protagonista; o rótulo fica pequeno, embaixo.

const SIZES = {
  sm: "text-xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-4xl sm:text-5xl",
};

interface StatProps {
  label: string;
  value: React.ReactNode;
  size?: keyof typeof SIZES;
  // Realça o número com a cor do acento (ex.: a estatística da aba atual).
  accent?: boolean;
  hint?: string;
  // Posição na entrada em cascata; sem isto, aparece direto.
  order?: number;
  className?: string;
}

export function Stat({
  label,
  value,
  size = "md",
  accent = false,
  hint,
  order,
  className = "",
}: StatProps) {
  return (
    <div
      className={`flex min-w-0 flex-col-reverse gap-1 ${order === undefined ? "" : "animate-rise stagger"} ${className}`}
      style={
        order === undefined
          ? undefined
          : ({ "--i": order } as React.CSSProperties)
      }
    >
      <dt className="text-muted text-xs">{label}</dt>
      <dd
        className={`numeral ${SIZES[size]} ${accent ? "text-accent" : "text-fg"}`}
      >
        {value}
        {hint && (
          <span className="text-muted ml-1.5 text-xs font-normal tracking-normal">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

// Linha de estatísticas separadas por um fio, sem caixas em volta.
export function StatGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={`divide-line/60 flex divide-x [&>*]:min-w-0 [&>*]:flex-1 [&>*]:px-3 sm:[&>*]:px-4 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0 ${className}`}
    >
      {children}
    </dl>
  );
}

// Grade de estatísticas secundárias (ex.: números de goleiro).
export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
      {children}
    </dl>
  );
}
