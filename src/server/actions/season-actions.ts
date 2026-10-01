"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  activateSeason as activateSeasonService,
  createSeason as createSeasonService,
} from "../seasons/service";
import { protectedAction } from "./factory";

// Temporadas: só admin. A troca de temporada é sempre manual.
const MANAGE_STATS = { action: "stats.manage" } as const;

const createSeasonSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(40),
  gameEdition: z.string().trim().min(1, "Informe a edição do EA FC.").max(40),
});

const activateSeasonSchema = z.object({
  seasonId: z.number().int().positive(),
});

export const createSeason = protectedAction(MANAGE_STATS, {
  schema: createSeasonSchema,
  handler: async (input, context) => {
    const season = await createSeasonService(context, input);
    refresh();
    return season;
  },
});

export const activateSeason = protectedAction(MANAGE_STATS, {
  schema: activateSeasonSchema,
  handler: async (input, context) => {
    const season = await activateSeasonService(context, input);
    refresh();
    return season;
  },
});
