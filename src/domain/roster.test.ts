import { describe, expect, it } from "vitest";
import { ineligiblePlayerIds, selectablePlayers } from "./roster";

const ERICKY = { id: 1, isActive: true };
const LUCAO = { id: 2, isActive: true };
const FELP = { id: 3, isActive: false };
const HEIT = { id: 4, isActive: false };
const roster = [ERICKY, LUCAO, FELP, HEIT];

describe("jogadores selecionáveis em uma partida", () => {
  it("na criação, só os ativos", () => {
    expect(selectablePlayers(roster)).toEqual([ERICKY, LUCAO]);
  });

  it("na edição, os ativos e quem já participa, mesmo inativo", () => {
    expect(selectablePlayers(roster, [FELP.id, ERICKY.id])).toEqual([
      ERICKY,
      LUCAO,
      FELP,
    ]);
  });

  it("inativo que não participa da partida continua de fora", () => {
    const ids = selectablePlayers(roster, [FELP.id]).map((player) => player.id);
    expect(ids).not.toContain(HEIT.id);
  });

  it("preserva a ordem do elenco e os demais campos", () => {
    const named = [
      { id: 9, isActive: false, name: "Antigo" },
      { id: 5, isActive: true, name: "Atual" },
    ];
    expect(selectablePlayers(named, [9])).toEqual(named);
  });
});

describe("jogadores que não podem participar", () => {
  it("criação: ativos passam, inativos e inexistentes não", () => {
    expect(ineligiblePlayerIds([1, 2], roster)).toEqual([]);
    expect(ineligiblePlayerIds([1, 3, 99], roster)).toEqual([3, 99]);
  });

  it("edição: inativo que já estava na partida pode ser mantido", () => {
    expect(ineligiblePlayerIds([1, 3], roster, [3])).toEqual([]);
  });

  it("edição: inativo de fora da partida não pode ser adicionado", () => {
    expect(ineligiblePlayerIds([3, 4], roster, [3])).toEqual([4]);
  });

  it("remover o inativo da partida é sempre permitido", () => {
    // Ele estava na partida e não foi pedido de novo: nada a recusar.
    expect(ineligiblePlayerIds([1], roster, [3])).toEqual([]);
  });
});
