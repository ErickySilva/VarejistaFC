import { pgEnum } from "drizzle-orm/pg-core";

export const positionEnum = pgEnum("position", [
  "GOL",
  "ZAG",
  "LD",
  "LE",
  "VOL",
  "MC",
  "MD",
  "ME",
  "MEI",
  "PD",
  "PE",
  "SA",
  "ATA",
]);

export const nightStatusEnum = pgEnum("night_status", ["open", "closed"]);

export const matchTypeEnum = pgEnum("match_type", [
  "friendly",
  "league",
  "playoff",
  "tournament",
]);

export const awardTypeEnum = pgEnum("award_type", [
  "top_scorer",
  "top_assists",
  "top_ga",
  "mvp",
  "best_goalkeeper",
]);

export const nicknameToneEnum = pgEnum("nickname_tone", ["good", "bad"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "close",
  "reopen",
  "recalculate",
]);
