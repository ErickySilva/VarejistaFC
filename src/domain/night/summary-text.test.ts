import { describe, expect, it } from "vitest";
import { summarizeNight } from "./summary";
import { renderNightSummary } from "./summary-text";
import type { NightMatch, NightParticipation } from "./types";

const NAMES: Record<number, string> = {
  1: "Ericky",
  2: "Lucão",
  3: "Felp",
  4: "Heit",
};
const name = (playerId: number) => NAMES[playerId];

function match(
  id: number,
  goalsFor: number,
  goalsAgainst: number,
  result: NightMatch["result"],
  wentToPenalties = false,
): NightMatch {
  return { id, goalsFor, goalsAgainst, result, wentToPenalties };
}

function played(
  playerId: number,
  matchId: number,
  rating: number,
  goals = 0,
  assists = 0,
  position: NightParticipation["position"] = "MC",
): NightParticipation {
  return { playerId, matchId, position, goals, assists, rating };
}

describe("texto do resumo da noite", () => {
  it("descreve partidas, gols e prêmios", () => {
    const summary = summarizeNight({
      matches: [match(1, 3, 0, "W"), match(2, 1, 2, "L")],
      participations: [
        played(2, 1, 9.0, 2, 0, "ATA"),
        played(1, 1, 8.0, 0, 2, "MEI"),
        played(4, 1, 8.5, 0, 0, "GOL"),
        played(2, 2, 7.0, 1, 0, "ATA"),
        played(1, 2, 6.0, 0, 0, "MEI"),
      ],
    });

    expect(renderNightSummary(summary, name)).toBe(
      "2 partidas: 1 vitória, 0 empates e 1 derrota. " +
        "4 gols marcados e 2 sofridos. " +
        "Artilheiro: Lucão (3 gols). " +
        "Líder de assistências: Ericky (2 assistências). " +
        "Líder de G/A: Lucão (3 G/A). " +
        "Craque da noite: Heit (média 8,50). " +
        "Destaque do goleiro: Heit (média 8,50).",
    );
  });

  it("usa o singular e cita as decisões nos pênaltis", () => {
    const summary = summarizeNight({
      matches: [match(1, 1, 1, "W", true)],
      participations: [played(2, 1, 7.8, 1, 0, "ATA")],
    });

    expect(renderNightSummary(summary, name)).toBe(
      "1 partida: 1 vitória, 0 empates e 0 derrotas. " +
        "Nos pênaltis: 1 vitória. " +
        "1 gol marcado e 1 sofrido. " +
        "Artilheiro: Lucão (1 gol). " +
        "Líder de G/A: Lucão (1 G/A). " +
        "Craque da noite: Lucão (média 7,80).",
    );
  });

  it("junta co-vencedores na mesma frase", () => {
    const summary = summarizeNight({
      matches: [match(1, 4, 0, "W")],
      participations: [
        played(1, 1, 8.0, 1, 1),
        played(2, 1, 8.0, 1, 1),
        played(3, 1, 8.0, 1, 1),
      ],
    });

    const text = renderNightSummary(summary, name);
    expect(text).toContain("Artilheiro: Ericky, Lucão e Felp (1 gol).");
    expect(text).toContain(
      "Craque da noite: Ericky, Lucão e Felp (média 8,00).",
    );
  });

  it("noite sem gols não cita artilheiro", () => {
    const summary = summarizeNight({
      matches: [match(1, 0, 0, "D")],
      participations: [played(1, 1, 6.0)],
    });

    expect(renderNightSummary(summary, name)).toBe(
      "1 partida: 0 vitórias, 1 empate e 0 derrotas. " +
        "0 gols marcados e 0 sofridos. " +
        "Craque da noite: Ericky (média 6,00).",
    );
  });
});
