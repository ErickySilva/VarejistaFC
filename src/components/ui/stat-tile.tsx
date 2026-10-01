interface StatTileProps {
  label: string;
  value: string | number;
  // Texto pequeno sob o valor (ex.: "em 12 partidas avaliadas").
  hint?: string;
}

// Um número de destaque com seu rótulo.
export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="border-foreground/15 rounded border p-3">
      <dt className="text-xs opacity-70">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</dl>;
}
