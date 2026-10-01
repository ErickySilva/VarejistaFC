export interface RosterMember {
  id: number;
  isActive: boolean;
}

// Jogadores que podem ser escolhidos em uma partida: os ativos e, na edição,
// também quem já participa dela, mesmo que tenha sido desativado depois. Um
// jogador desativado não some da partida que jogou, mas não entra em outras.
export function selectablePlayers<T extends RosterMember>(
  players: readonly T[],
  currentParticipantIds: readonly number[] = [],
): T[] {
  const current = new Set(currentParticipantIds);
  return players.filter((player) => player.isActive || current.has(player.id));
}

// Ids pedidos que não podem participar: inexistentes, ou inativos que não
// estavam na partida.
export function ineligiblePlayerIds(
  requestedIds: readonly number[],
  players: readonly RosterMember[],
  currentParticipantIds: readonly number[] = [],
): number[] {
  const allowed = new Set(
    selectablePlayers(players, currentParticipantIds).map(
      (player) => player.id,
    ),
  );
  return requestedIds.filter((id) => !allowed.has(id));
}
