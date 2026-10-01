"use client";

import { useState } from "react";

export interface TrendPoint {
  // Rótulo do eixo X (ex.: data da gameplay).
  label: string;
  // null = sem valor neste ponto (ex.: o jogador não jogou).
  value: number | null;
  // Valor já formatado para leitura.
  display: string;
}

interface TrendChartProps {
  title: string;
  points: TrendPoint[];
  // Para posição no ranking: 1 fica no topo.
  invert?: boolean;
  // Eixo só com inteiros (ex.: posição).
  integers?: boolean;
}

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 12, right: 44, bottom: 24, left: 34 };

function niceTicks(min: number, max: number, integers: boolean): number[] {
  if (integers) {
    const ticks = [];
    for (let value = Math.ceil(min); value <= Math.floor(max); value++) {
      ticks.push(value);
    }
    return ticks.length <= 5
      ? ticks
      : [ticks[0], ticks[Math.floor(ticks.length / 2)], ticks.at(-1)!];
  }
  return [min, (min + max) / 2, max];
}

// Linha de tendência de uma única série. Uma série só dispensa legenda (o
// título a nomeia) e usa a cor do texto: a identidade visual é provisória.
// Todo valor do gráfico também está na tabela logo abaixo.
export function TrendChart({
  title,
  points,
  invert = false,
  integers = false,
}: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const known = points.flatMap((point, index) =>
    point.value === null ? [] : [{ index, value: point.value }],
  );

  if (known.length < 2) {
    return (
      <figure className="border-foreground/15 rounded border p-3">
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <p className="mt-2 text-sm opacity-70">
          {known.length === 0
            ? "Ainda não há dados para mostrar."
            : `Um único registro até agora: ${points[known[0].index].display}.`}
        </p>
      </figure>
    );
  }

  const values = known.map((entry) => entry.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  if (integers) {
    min = Math.floor(min);
    max = Math.ceil(max);
  }

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left +
    (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => {
    const ratio = (value - min) / (max - min);
    return PAD.top + (invert ? ratio : 1 - ratio) * plotHeight;
  };

  // Um segmento por trecho contínuo: pontos sem valor quebram a linha.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${x(index).toFixed(1)},${y(point.value).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const last = known.at(-1)!;
  const ticks = niceTicks(min, max, integers);
  const format = (value: number) =>
    integers ? String(value) : value.toFixed(1).replace(".", ",");

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    // O ponto com valor mais próximo do ponteiro, não exatamente sob ele.
    let nearest = known[0].index;
    for (const entry of known) {
      if (
        Math.abs(x(entry.index) - position) < Math.abs(x(nearest) - position)
      ) {
        nearest = entry.index;
      }
    }
    setActive(nearest);
  }

  const activePoint = active === null ? null : points[active];

  return (
    <figure className="border-foreground/15 rounded border p-3">
      <figcaption className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums" aria-live="polite">
          {activePoint ? (
            <>
              <strong>{activePoint.display}</strong>{" "}
              <span className="opacity-70">{activePoint.label}</span>
            </>
          ) : (
            <span className="opacity-70">toque no gráfico</span>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: de ${points[known[0].index].display} em ${points[known[0].index].label} a ${points[last.index].display} em ${points[last.index].label}`}
        className="mt-2 w-full touch-pan-y"
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.6}
            >
              {format(tick)}
            </text>
          </g>
        ))}

        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        )}

        {segments.map((segment) => (
          <polyline
            key={segment}
            points={segment}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Marcadores só no ponto final e no ponto em destaque. */}
        {[
          last.index,
          ...(active !== null && active !== last.index ? [active] : []),
        ]
          .filter((index) => points[index].value !== null)
          .map((index) => (
            <circle
              key={index}
              cx={x(index)}
              cy={y(points[index].value!)}
              r={4}
              fill="currentColor"
              stroke="var(--background)"
              strokeWidth={2}
            />
          ))}

        <text
          x={x(last.index) + 8}
          y={y(last.value)}
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill="currentColor"
        >
          {points[last.index].display}
        </text>

        <text
          x={PAD.left}
          y={HEIGHT - 6}
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {points[0].label}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          textAnchor="end"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {points.at(-1)!.label}
        </text>
      </svg>

      <details className="mt-1 text-sm">
        <summary className="cursor-pointer opacity-70">Ver em tabela</summary>
        <table className="mt-2 w-full">
          <tbody>
            {points.map((point) => (
              <tr key={point.label} className="border-foreground/10 border-b">
                <td className="py-1">{point.label}</td>
                <td className="py-1 text-right tabular-nums">
                  {point.display}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
