"use server";

import {
  deactivateAccount as deactivateAccountService,
  listAccounts as listAccountsService,
  reactivateAccount as reactivateAccountService,
  setAccountPassword as setAccountPasswordService,
  setAccountPlayer as setAccountPlayerService,
  setAccountRole as setAccountRoleService,
} from "../users/service";
import { protectedAction } from "./factory";
import {
  accountIdSchema,
  noInputSchema,
  setAccountPasswordSchema,
  setAccountPlayerSchema,
  setAccountRoleSchema,
} from "./schemas";

// Gestão de contas: tudo aqui exige admin. A permissão é conferida no envelope
// e de novo no serviço, junto do dado. Contas novas nascem pelo convite
// (invite-actions.ts): o admin não define a senha de ninguém ao criar.
const MANAGE_ACCOUNTS = { action: "accounts.manage" } as const;

export const listAccounts = protectedAction(MANAGE_ACCOUNTS, {
  schema: noInputSchema,
  handler: (_input, context) => listAccountsService(context),
});

export const setAccountRole = protectedAction(MANAGE_ACCOUNTS, {
  schema: setAccountRoleSchema,
  handler: (input, context) => setAccountRoleService(context, input),
});

export const setAccountPlayer = protectedAction(MANAGE_ACCOUNTS, {
  schema: setAccountPlayerSchema,
  handler: (input, context) => setAccountPlayerService(context, input),
});

export const setAccountPassword = protectedAction(MANAGE_ACCOUNTS, {
  schema: setAccountPasswordSchema,
  handler: (input, context) => setAccountPasswordService(context, input),
});

export const deactivateAccount = protectedAction(MANAGE_ACCOUNTS, {
  schema: accountIdSchema,
  handler: (input, context) => deactivateAccountService(context, input),
});

export const reactivateAccount = protectedAction(MANAGE_ACCOUNTS, {
  schema: accountIdSchema,
  handler: (input, context) => reactivateAccountService(context, input),
});
