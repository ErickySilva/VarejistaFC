-- Tipos de partida definitivos, temporada ativa, histórico por temporada,
-- Nota FIFA e prêmios definitivos (ADR 0013).
--
-- A parte de tabelas foi gerada pelo drizzle-kit e ajustada à mão: as views
-- dependem das colunas alteradas e precisam sair antes e voltar depois, e o
-- histórico existente precisa ser ligado a uma temporada antes de a coluna
-- virar obrigatória.

DROP VIEW v_player_totals_overall;--> statement-breakpoint
DROP VIEW v_player_totals_system;--> statement-breakpoint
DROP VIEW v_player_match;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 1. Prêmios: Artilheiro, Assistente, Craque da Noite e Destaque do Rush.
--    Prêmios gravados com tipos que deixaram de existir são removidos; eles
--    são sempre recalculáveis a partir das partidas.
-- ---------------------------------------------------------------------------
ALTER TABLE "night_awards" ALTER COLUMN "award" SET DATA TYPE text;--> statement-breakpoint
DELETE FROM "night_awards" WHERE "award" NOT IN ('top_scorer', 'top_assists', 'mvp');--> statement-breakpoint
DROP TYPE "public"."award_type";--> statement-breakpoint
CREATE TYPE "public"."award_type" AS ENUM('top_scorer', 'top_assists', 'mvp', 'rush_mvp');--> statement-breakpoint
ALTER TABLE "night_awards" ALTER COLUMN "award" SET DATA TYPE "public"."award_type" USING "award"::"public"."award_type";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Tipos de partida: X1, Partida e Torneio de Rush, agora obrigatório.
--    Partidas com os tipos antigos, ou sem tipo, viram "Partida".
-- ---------------------------------------------------------------------------
ALTER TABLE "matches" ALTER COLUMN "match_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "matches" SET "match_type" = 'match' WHERE "match_type" IS NULL OR "match_type" NOT IN ('x1', 'match', 'rush');--> statement-breakpoint
DROP TYPE "public"."match_type";--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('x1', 'match', 'rush');--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "match_type" SET DATA TYPE "public"."match_type" USING "match_type"::"public"."match_type";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "match_type" SET NOT NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Temporadas: troca manual, no máximo uma ativa; datas opcionais.
-- ---------------------------------------------------------------------------
ALTER TABLE "seasons" ALTER COLUMN "starts_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_single_active_idx" ON "seasons" USING btree ("is_active") WHERE is_active;--> statement-breakpoint
-- A temporada mais recente já cadastrada passa a ser a ativa.
UPDATE "seasons" SET "is_active" = true
WHERE "id" = (SELECT "id" FROM "seasons" ORDER BY "starts_on" DESC NULLS LAST, "id" DESC LIMIT 1);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Histórico pré-sistema por temporada. O histórico já cadastrado é ligado
--    à temporada histórica FC 25, criada aqui se houver histórico e ela ainda
--    não existir. Nenhuma partida é criada e nenhuma nota é inventada.
-- ---------------------------------------------------------------------------
ALTER TABLE "legacy_stats" ADD COLUMN "season_id" integer;--> statement-breakpoint
INSERT INTO "seasons" ("slug", "name", "game_edition", "starts_on", "is_active")
SELECT 'fc-25', 'FC 25', 'FC 25', NULL, false
WHERE EXISTS (SELECT 1 FROM "legacy_stats")
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "legacy_stats" SET "season_id" = (SELECT "id" FROM "seasons" WHERE "slug" = 'fc-25');--> statement-breakpoint
ALTER TABLE "legacy_stats" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legacy_stats" DROP CONSTRAINT "legacy_stats_pkey";--> statement-breakpoint
ALTER TABLE "legacy_stats" ADD CONSTRAINT "legacy_stats_player_id_season_id_pk" PRIMARY KEY("player_id","season_id");--> statement-breakpoint
ALTER TABLE "legacy_stats" ADD CONSTRAINT "legacy_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Nota FIFA: informada à mão, só informativa. A coluna `rating` continua
--    sendo a Nota VFC.
-- ---------------------------------------------------------------------------
ALTER TABLE "match_players" ADD COLUMN "fifa_rating" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_fifa_rating_range" CHECK (fifa_rating is null or fifa_rating between 0.0 and 10.0);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. Apelidos da lore com a grafia definitiva. Só altera os dois rótulos
--    iniciais, se ainda estiverem como foram semeados.
-- ---------------------------------------------------------------------------
UPDATE "nicknames" SET "label" = 'EL GARRO' WHERE "label" = 'EL GARRÓ';--> statement-breakpoint
UPDATE "nicknames" SET "label" = 'PERNINHA' WHERE "label" = 'PONTINHA BURRO';--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 7. Views
-- ---------------------------------------------------------------------------

-- Uma linha por participação em partida não excluída. `stats_scope` é o
-- recorte de estatísticas: o Rush fica fora das principais e tem as suas.
-- A mesma regra existe em src/domain/match-type.ts.
CREATE VIEW v_player_match AS
SELECT
  mp.player_id,
  mp.match_id,
  m.night_id,
  n.season_id,
  n.reference_date,
  date_trunc('month', n.reference_date)::date AS reference_month,
  m.sequence,
  m.played_at,
  m.opponent_id,
  m.match_type,
  m.goals_for,
  m.goals_against,
  m.went_to_penalties,
  m.result,
  mp."position",
  mp.goals,
  mp.assists,
  mp.goals + mp.assists AS goal_contributions,
  mp.rating,
  mp.rating_version,
  mp."position" = 'GOL' AS is_goalkeeper,
  mp.saves,
  mp.penalties_saved,
  CASE WHEN mp."position" = 'GOL' THEN m.goals_against END AS goals_conceded,
  mp."position" = 'GOL' AND m.goals_against = 0 AS clean_sheet,
  CASE WHEN m.match_type = 'rush' THEN 'rush' ELSE 'main' END AS stats_scope,
  mp.fifa_rating
FROM match_players mp
JOIN matches m ON m.id = mp.match_id AND m.deleted_at IS NULL
JOIN nights n ON n.id = m.night_id;
--> statement-breakpoint

-- Totais do sistema por jogador, temporada e recorte. É a base de todas as
-- visões: temporada, desde a criação do clube, principais e Rush. As somas de
-- nota ficam expostas para que médias de vários períodos sejam calculadas
-- corretamente (soma ÷ partidas), e não como média de médias.
CREATE VIEW v_player_period_totals AS
SELECT
  pm.player_id,
  pm.season_id,
  pm.stats_scope,
  count(*)::integer AS matches,
  sum(pm.goals)::integer AS goals,
  sum(pm.assists)::integer AS assists,
  sum(pm.goal_contributions)::integer AS goal_contributions,
  count(*) FILTER (WHERE pm.result = 'W')::integer AS wins,
  count(*) FILTER (WHERE pm.result = 'D')::integer AS draws,
  count(*) FILTER (WHERE pm.result = 'L')::integer AS losses,
  sum(pm.rating) AS rating_sum,
  count(pm.fifa_rating)::integer AS fifa_rated_matches,
  coalesce(sum(pm.fifa_rating), 0) AS fifa_rating_sum,
  count(*) FILTER (WHERE pm.is_goalkeeper)::integer AS goalkeeper_matches,
  coalesce(sum(pm.saves), 0)::integer AS saves,
  coalesce(sum(pm.penalties_saved), 0)::integer AS penalties_saved,
  coalesce(sum(pm.goals_conceded), 0)::integer AS goals_conceded,
  count(*) FILTER (WHERE pm.clean_sheet)::integer AS clean_sheets,
  coalesce(sum(pm.rating) FILTER (WHERE pm.is_goalkeeper), 0) AS goalkeeper_rating_sum
FROM v_player_match pm
GROUP BY pm.player_id, pm.season_id, pm.stats_scope;
--> statement-breakpoint

-- Totais por jogador nas estatísticas principais (X1 e Partida), considerando
-- apenas partidas registradas no sistema, em todas as temporadas. O Rush não
-- entra. Jogadores sem nenhuma partida aparecem com zeros.
CREATE VIEW v_player_totals_system AS
SELECT
  p.id AS player_id,
  count(pm.match_id)::integer AS matches,
  coalesce(sum(pm.goals), 0)::integer AS goals,
  coalesce(sum(pm.assists), 0)::integer AS assists,
  coalesce(sum(pm.goal_contributions), 0)::integer AS goal_contributions,
  count(*) FILTER (WHERE pm.result = 'W')::integer AS wins,
  count(*) FILTER (WHERE pm.result = 'D')::integer AS draws,
  count(*) FILTER (WHERE pm.result = 'L')::integer AS losses,
  round(avg(pm.rating), 2) AS average_rating,
  count(*) FILTER (WHERE pm.is_goalkeeper)::integer AS goalkeeper_matches,
  coalesce(sum(pm.saves), 0)::integer AS saves,
  coalesce(sum(pm.penalties_saved), 0)::integer AS penalties_saved,
  coalesce(sum(pm.goals_conceded), 0)::integer AS goals_conceded,
  count(*) FILTER (WHERE pm.clean_sheet)::integer AS clean_sheets
FROM players p
LEFT JOIN v_player_match pm ON pm.player_id = p.id AND pm.stats_scope = 'main'
GROUP BY p.id;
--> statement-breakpoint

-- Desde a criação do clube: sistema (principais) + histórico pré-sistema de
-- todas as temporadas, com as parcelas separadas. legacy_clean_sheets nulo
-- significa "não anotado" e soma como zero no total.
CREATE VIEW v_player_totals_overall AS
SELECT
  s.player_id,
  s.matches AS system_matches,
  coalesce(l.matches, 0) AS legacy_matches,
  s.matches + coalesce(l.matches, 0) AS total_matches,
  s.goals AS system_goals,
  coalesce(l.goals, 0) AS legacy_goals,
  s.goals + coalesce(l.goals, 0) AS total_goals,
  s.assists AS system_assists,
  coalesce(l.assists, 0) AS legacy_assists,
  s.assists + coalesce(l.assists, 0) AS total_assists,
  s.goal_contributions AS system_goal_contributions,
  coalesce(l.goals + l.assists, 0) AS legacy_goal_contributions,
  s.goal_contributions + coalesce(l.goals + l.assists, 0) AS total_goal_contributions,
  s.clean_sheets AS system_clean_sheets,
  l.clean_sheets AS legacy_clean_sheets,
  s.clean_sheets + coalesce(l.clean_sheets, 0) AS total_clean_sheets
FROM v_player_totals_system s
LEFT JOIN (
  SELECT
    player_id,
    sum(matches)::integer AS matches,
    sum(goals)::integer AS goals,
    sum(assists)::integer AS assists,
    sum(clean_sheets)::integer AS clean_sheets
  FROM legacy_stats
  GROUP BY player_id
) l ON l.player_id = s.player_id;
