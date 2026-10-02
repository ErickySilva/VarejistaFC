import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, type UserRole } from "./auth";
import { players } from "./players";

// Convite para um jogador criar a própria conta (ADR 0015). Cada convite já
// nasce ligado a um jogador e a um papel, escolhidos pelo admin que o gerou:
// quem se cadastra não informa nenhum dos dois.
//
// O código do convite não é gravado. Fica só o hash; o texto é mostrado ao
// admin uma única vez, na geração.
export const accountInvites = pgTable(
  "account_invites",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    role: text("role").$type<UserRole>().notNull(),
    // SHA-256 do código, em hexadecimal.
    codeHash: text("code_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Uso único: preenchidos juntos quando a conta é criada.
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByUserId: text("used_by_user_id").references(() => users.id),
    // Invalidado por um convite mais novo para o mesmo jogador.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("account_invites_role_valid", sql`role in ('admin', 'player')`),
    check(
      "account_invites_used_fields_together",
      sql`(used_at is null) = (used_by_user_id is null)`,
    ),
    check(
      "account_invites_used_or_revoked",
      sql`used_at is null or revoked_at is null`,
    ),
    // No máximo um convite pendente por jogador. Um convite vencido continua
    // pendente até ser substituído; a validade é conferida na hora do uso.
    uniqueIndex("account_invites_one_pending_per_player_idx")
      .on(t.playerId)
      .where(sql`used_at is null and revoked_at is null`),
    index("account_invites_player_idx").on(t.playerId),
  ],
);
