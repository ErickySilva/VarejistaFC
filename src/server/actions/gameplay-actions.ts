"use server";

import { refresh } from "next/cache";
import {
  deleteMatch as deleteMatchService,
  registerMatch as registerMatchService,
  updateMatch as updateMatchService,
} from "../matches/service";
import {
  cancelGameplay as cancelGameplayService,
  closeGameplay as closeGameplayService,
  startGameplay as startGameplayService,
} from "../nights/service";
import { protectedAction } from "./factory";
import {
  matchIdSchema,
  matchInputSchema,
  updateMatchSchema,
} from "./gameplay-schemas";
import { noInputSchema } from "./schemas";

// Gameplay: só admin (stats.manage). A permissão é conferida no envelope e de
// novo em cada serviço. Depois de cada alteração a tela de quem operou é
// atualizada na hora.
const MANAGE_STATS = { action: "stats.manage" } as const;

export const startGameplay = protectedAction(MANAGE_STATS, {
  schema: noInputSchema,
  handler: async (_input, context) => {
    const result = await startGameplayService(context);
    refresh();
    return result;
  },
});

export const closeGameplay = protectedAction(MANAGE_STATS, {
  schema: noInputSchema,
  handler: async (_input, context) => {
    const night = await closeGameplayService(context);
    refresh();
    return { nightId: night.id };
  },
});

export const cancelGameplay = protectedAction(MANAGE_STATS, {
  schema: noInputSchema,
  handler: async (_input, context) => {
    await cancelGameplayService(context);
    refresh();
  },
});

export const registerMatch = protectedAction(MANAGE_STATS, {
  schema: matchInputSchema,
  handler: async (input, context) => {
    const match = await registerMatchService(context, input);
    refresh();
    return { matchId: match.id };
  },
});

export const updateMatch = protectedAction(MANAGE_STATS, {
  schema: updateMatchSchema,
  handler: async (input, context) => {
    const match = await updateMatchService(context, input);
    refresh();
    return { matchId: match.id };
  },
});

export const deleteMatch = protectedAction(MANAGE_STATS, {
  schema: matchIdSchema,
  handler: async (input, context) => {
    await deleteMatchService(context, input);
    refresh();
  },
});
