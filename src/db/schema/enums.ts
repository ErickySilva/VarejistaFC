import { pgEnum } from "drizzle-orm/pg-core";
import { AWARD_TYPES } from "../../domain/night/types";
import { POSITIONS } from "../../domain/positions";

// Posições e prêmios são definidos no domínio; o banco segue a mesma lista.
export const positionEnum = pgEnum("position", POSITIONS);

export const nightStatusEnum = pgEnum("night_status", ["open", "closed"]);

export const matchTypeEnum = pgEnum("match_type", [
  "friendly",
  "league",
  "playoff",
  "tournament",
]);

export const awardTypeEnum = pgEnum("award_type", AWARD_TYPES);

export const nicknameToneEnum = pgEnum("nickname_tone", ["good", "bad"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "close",
  "reopen",
  "recalculate",
]);
