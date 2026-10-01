"use server";

import { setPlayerPhoto as setPlayerPhotoService } from "../players/service";
import { protectedAction } from "./factory";
import { setPlayerPhotoSchema } from "./schemas";

// A permissão depende do jogador informado: admin altera qualquer foto, e um
// `player` só a do jogador vinculado à própria conta.
export const setPlayerPhoto = protectedAction(
  (input) => ({ action: "players.edit-photo", playerId: input.playerId }),
  {
    schema: setPlayerPhotoSchema,
    handler: (input, context) => setPlayerPhotoService(context, input),
  },
);
