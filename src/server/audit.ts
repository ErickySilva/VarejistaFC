import "server-only";
import { currentTransaction } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction = (typeof auditLog.$inferInsert)["action"];

export interface AuditEntry {
  // Usuário da sessão lida no servidor; null para ações do sistema. Nunca vem
  // de dados enviados pelo cliente.
  actorUserId: string | null;
  action: AuditAction;
  // Nome da tabela e identificador da linha alterada.
  entity: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
}

// Grava o registro de auditoria na transação em andamento. Exige uma
// transação aberta com `withTransaction`: assim a alteração e a auditoria são
// confirmadas juntas ou desfeitas juntas (ADR 0006).
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const transaction = currentTransaction();
  if (!transaction) {
    throw new Error(
      "recordAudit precisa ser chamado dentro de withTransaction, junto com a alteração auditada.",
    );
  }

  await transaction.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: String(entry.entityId),
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
