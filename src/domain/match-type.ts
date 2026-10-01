// Tipos de partida do produto. Fonte única: o enum do banco é criado a partir
// desta lista.
export const MATCH_TYPES = ["x1", "match", "rush"] as const;

export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_TYPE_LABEL: Record<MatchType, string> = {
  // Partida combinada contra outro time (não é um contra um).
  x1: "X1",
  // Partida normal de Pro Clubs.
  match: "Partida",
  rush: "Torneio de Rush",
};

// Recorte das estatísticas. O Rush é registrado por inteiro, mas fica fora das
// estatísticas principais e tem as suas próprias (ADR 0013).
export const STATS_SCOPES = ["main", "rush"] as const;

export type StatsScope = (typeof STATS_SCOPES)[number];

// A mesma regra existe na view `v_player_match` (coluna `stats_scope`); um
// teste de integração confere que as duas concordam.
export function statsScope(matchType: MatchType): StatsScope {
  return matchType === "rush" ? "rush" : "main";
}
