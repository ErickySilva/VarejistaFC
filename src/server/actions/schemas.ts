import { z } from "zod";
import { USER_ROLES } from "@/db/schema";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../auth/constants";

// Entradas das Server Actions de autenticação e de contas. Nenhum schema tem
// campo de autor: quem executa a ação vem sempre da sessão lida no servidor.

const email = z.email("Informe um e-mail válido.").trim().toLowerCase();

const newPassword = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  )
  .max(
    MAX_PASSWORD_LENGTH,
    `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`,
  );

const userId = z.string().min(1);
const playerId = z.number().int().positive();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

// Entrada pelo tile do jogador: o slug identifica o jogador; o e-mail da
// conta nunca vem do cliente.
export const playerSignInSchema = z.object({
  playerSlug: z.string().min(1).max(60),
  password: z.string().min(1, "Informe a senha."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword,
});

// Convite gerado por um admin: o jogador e o papel da futura conta.
export const generateInviteSchema = z.strictObject({
  playerId,
  role: z.enum(USER_ROLES),
});

// O que a pessoa digitou ou colou; o formato é conferido no serviço, que
// responde o mesmo para qualquer código que não sirva.
const inviteCode = z
  .string()
  .trim()
  .min(1, "Informe o código do convite.")
  .max(64, "Informe o código do convite.");

export const checkInviteSchema = z.strictObject({ code: inviteCode });

// Cadastro por convite. Objeto estrito: qualquer campo a mais, como
// `playerId` ou `role`, faz a requisição inteira ser recusada. O jogador e o
// papel vêm só do convite gravado no banco.
export const registerWithInviteSchema = z
  .strictObject({
    code: inviteCode,
    email,
    password: newPassword,
    passwordConfirmation: z.string(),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não são iguais.",
  });

export const setAccountRoleSchema = z.object({
  userId,
  role: z.enum(USER_ROLES),
});

export const setAccountPlayerSchema = z.object({
  userId,
  playerId: playerId.nullable(),
});

export const setAccountPasswordSchema = z.object({ userId, newPassword });

export const accountIdSchema = z.object({ userId });

// Endereço http(s) ou caminho local da aplicação; `null` remove a foto.
const photoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => /^https?:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value),
    "Informe um endereço http(s) ou um caminho que comece com /.",
  );

export const setPlayerPhotoSchema = z.object({
  playerId,
  photoUrl: photoUrl.nullable(),
});

export const noInputSchema = z.undefined();
