import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  matchPlayers,
  nicknames,
  opponents,
  players,
  playerTotalsOverallView,
} from "@/db/schema";
import type { Position } from "@/domain/positions";
import { selectablePlayers } from "@/domain/roster";

// Leituras públicas de jogadores, adversários e ranking.

export interface RosterPlayer {
  id: number;
  name: string;
  shirtNumber: number;
  defaultPosition: Position;
  isActive: boolean;
}

async function listAllPlayers(): Promise<RosterPlayer[]> {
  return getDb()
    .select({
      id: players.id,
      name: players.name,
      shirtNumber: players.shirtNumber,
      defaultPosition: players.defaultPosition,
      isActive: players.isActive,
    })
    .from(players)
    .orderBy(asc(players.shirtNumber));
}

// Elenco para registrar uma partida nova: só jogadores ativos.
export async function listActivePlayers(): Promise<RosterPlayer[]> {
  return selectablePlayers(await listAllPlayers());
}

// Elenco para corrigir uma partida: os ativos e quem já participa dela, mesmo
// que tenha sido desativado depois. Não afeta nenhuma outra partida.
export async function listPlayersForMatch(
  matchId: number,
): Promise<RosterPlayer[]> {
  const participants = await getDb()
    .select({ playerId: matchPlayers.playerId })
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));
  return selectablePlayers(
    await listAllPlayers(),
    participants.map((participant) => participant.playerId),
  );
}

export interface PlayerProfile extends RosterPlayer {
  slug: string;
  photoUrl: string | null;
  // Apelidos cadastrados à mão; nunca são deduzidos da nota.
  goodNicknames: string[];
  badNicknames: string[];
}

// Perfil público de um jogador pelo slug. Não inclui nenhum dado de conta
// (e-mail, papel): isso não é exposto a visitantes.
export async function getPlayerProfile(
  slug: string,
): Promise<PlayerProfile | null> {
  const [player] = await getDb()
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      shirtNumber: players.shirtNumber,
      defaultPosition: players.defaultPosition,
      photoUrl: players.photoUrl,
      isActive: players.isActive,
    })
    .from(players)
    .where(eq(players.slug, slug));
  if (!player) return null;

  const labels = await getDb()
    .select({ label: nicknames.label, tone: nicknames.tone })
    .from(nicknames)
    .where(and(eq(nicknames.playerId, player.id), eq(nicknames.isActive, true)))
    .orderBy(asc(nicknames.id));

  return {
    ...player,
    goodNicknames: labels
      .filter((nickname) => nickname.tone === "good")
      .map((nickname) => nickname.label),
    badNicknames: labels
      .filter((nickname) => nickname.tone === "bad")
      .map((nickname) => nickname.label),
  };
}

export async function listOpponentNames(): Promise<string[]> {
  const rows = await getDb()
    .select({ name: opponents.name })
    .from(opponents)
    .orderBy(asc(opponents.name));
  return rows.map((row) => row.name);
}

export interface OverallRankingRow {
  playerId: number;
  playerName: string;
  shirtNumber: number;
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
}

// Total geral (sistema + histórico pré-sistema), ordenado por G/A.
export async function getOverallRanking(): Promise<OverallRankingRow[]> {
  const totals = playerTotalsOverallView;
  return getDb()
    .select({
      playerId: players.id,
      playerName: players.name,
      shirtNumber: players.shirtNumber,
      matches: totals.totalMatches,
      goals: totals.totalGoals,
      assists: totals.totalAssists,
      goalContributions: totals.totalGoalContributions,
    })
    .from(totals)
    .innerJoin(players, eq(players.id, totals.playerId))
    .where(eq(players.isActive, true))
    .orderBy(
      desc(totals.totalGoalContributions),
      desc(totals.totalGoals),
      asc(players.shirtNumber),
    );
}
