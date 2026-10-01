import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns";

// Temporada, ligada à edição do EA FC (ADR 0013). A troca de temporada é
// manual, feita por um admin: as datas são só informativas e não decidem qual
// temporada está valendo.
export const seasons = pgTable(
  "seasons",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    // Edição do EA FC, ex.: "FC 26".
    gameEdition: text("game_edition").notNull(),
    // Opcional: nem toda temporada histórica tem data conhecida.
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    // A temporada em que as novas gameplays são registradas.
    isActive: boolean("is_active").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check("seasons_date_order", sql`ends_on is null or ends_on >= starts_on`),
    // No máximo uma temporada ativa.
    uniqueIndex("seasons_single_active_idx")
      .on(t.isActive)
      .where(sql`is_active`),
  ],
);
