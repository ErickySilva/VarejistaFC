"use server";

import {
  checkInvite as checkInviteService,
  generateInvite as generateInviteService,
  registerWithInvite as registerWithInviteService,
} from "../invites/service";
import { protectedAction, publicAction } from "./factory";
import {
  checkInviteSchema,
  generateInviteSchema,
  registerWithInviteSchema,
} from "./schemas";

// Convites e cadastro (ADR 0015).

// Só admin gera convite. A resposta é a única vez em que o código aparece.
export const generateInvite = protectedAction(
  { action: "accounts.manage" },
  {
    schema: generateInviteSchema,
    handler: (input, context) => generateInviteService(context, input),
  },
);

// As duas abaixo são abertas: quem se cadastra ainda não tem conta. O que
// autoriza é o código do convite.
export const checkInvite = publicAction({
  schema: checkInviteSchema,
  handler: (input, context) => checkInviteService(context.headers, input),
});

export const registerWithInvite = publicAction({
  schema: registerWithInviteSchema,
  // Só código, e-mail e senha seguem para o serviço.
  handler: ({ code, email, password }, context) =>
    registerWithInviteService(context.headers, { code, email, password }),
});
