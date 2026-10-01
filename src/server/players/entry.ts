import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { players, users } from "@/db/schema";

// Jogadores mostrados na tela de entrada. Leitura pública: só nome, número,
// foto e se existe uma conta para entrar. Nenhum e-mail sai daqui.

export interface EntryPlayer {
  slug: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  // Existe uma conta ativa vinculada a este jogador.
  hasAccount: boolean;
}

const entryColumns = {
  slug: players.slug,
  name: players.name,
  shirtNumber: players.shirtNumber,
  photoUrl: players.photoUrl,
  userId: users.id,
};

function toEntryPlayer(row: {
  slug: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  userId: string | null;
}): EntryPlayer {
  const { userId, ...player } = row;
  return { ...player, hasAccount: userId !== null };
}

// Todos os jogadores ativos, para a entrada "Jogadores".
export async function listEntryPlayers(): Promise<EntryPlayer[]> {
  const rows = await getDb()
    .select(entryColumns)
    .from(players)
    .leftJoin(
      users,
      and(eq(users.playerId, players.id), eq(users.banned, false)),
    )
    .where(eq(players.isActive, true))
    .orderBy(asc(players.shirtNumber));
  return rows.map(toEntryPlayer);
}

// Só os jogadores cuja conta é de administrador, para a entrada "Admin".
export async function listAdminEntryPlayers(): Promise<EntryPlayer[]> {
  const rows = await getDb()
    .select(entryColumns)
    .from(players)
    .innerJoin(
      users,
      and(
        eq(users.playerId, players.id),
        eq(users.banned, false),
        eq(users.role, "admin"),
      ),
    )
    .where(eq(players.isActive, true))
    .orderBy(asc(players.shirtNumber));
  return rows.map(toEntryPlayer);
}

export async function getEntryPlayer(
  slug: string,
): Promise<EntryPlayer | null> {
  const players = await listEntryPlayers();
  return players.find((player) => player.slug === slug) ?? null;
}
