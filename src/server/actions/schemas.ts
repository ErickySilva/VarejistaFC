import { z } from "zod";
import { USER_ROLES } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "../auth/constants";

// Entradas das Server Actions de autenticação e de contas. Nenhum schema tem
// campo de autor: quem executa a ação vem sempre da sessão lida no servidor.

const email = z.email("Informe um e-mail válido.").trim().toLowerCase();

const newPassword = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  )
  .max(128, "A senha pode ter no máximo 128 caracteres.");

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

export const createAccountSchema = z.object({
  email,
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  password: newPassword,
  role: z.enum(USER_ROLES),
  playerId: playerId.nullable(),
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
