import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { auditActionEnum } from "./enums";

// Gravado na mesma transação da alteração e nunca editado (ADR 0006).
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // A chave estrangeira para a tabela de usuários entra na fase de autenticação.
    actorUserId: text("actor_user_id"),
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entity, t.entityId),
    index("audit_log_occurred_at_idx").on(t.occurredAt),
  ],
);
