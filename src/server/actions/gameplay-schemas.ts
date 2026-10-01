import { z } from "zod";
import { MATCH_TYPES } from "@/domain/match-type";
import { POSITIONS } from "@/domain/positions";

// Entradas das Server Actions da gameplay. Aqui só se confere o formato; as
// regras entre os campos (somas, goleiro, pênaltis) são do domínio, em
// src/domain/match-entry.ts, e as do banco continuam valendo por último.

const count = z.number().int().min(0).max(99);
const id = z.number().int().positive();

const participationSchema = z.object({
  playerId: id,
  position: z.enum(POSITIONS),
  goals: count,
  assists: count,
  saves: count.nullable(),
  penaltiesSaved: count.nullable(),
  // Nota FIFA: opcional. A casa decimal é conferida no domínio.
  fifaRating: z.number().min(0).max(10).nullable(),
});

export const matchInputSchema = z.object({
  opponentName: z
    .string()
    .trim()
    .min(1, "Informe o adversário.")
    .max(60, "O nome do adversário pode ter no máximo 60 caracteres."),
  matchType: z.enum(MATCH_TYPES, "Informe o tipo da partida."),
  goalsFor: count,
  goalsAgainst: count,
  wentToPenalties: z.boolean(),
  penaltyScoreFor: count.nullable(),
  penaltyScoreAgainst: count.nullable(),
  participations: z.array(participationSchema).max(30),
});

export const updateMatchSchema = matchInputSchema.extend({ matchId: id });

export const matchIdSchema = z.object({ matchId: id });

export type MatchInputValues = z.infer<typeof matchInputSchema>;
