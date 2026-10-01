CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'close', 'reopen', 'recalculate');--> statement-breakpoint
CREATE TYPE "public"."award_type" AS ENUM('top_scorer', 'top_assists', 'top_ga', 'mvp', 'best_goalkeeper');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('friendly', 'league', 'playoff', 'tournament');--> statement-breakpoint
CREATE TYPE "public"."nickname_tone" AS ENUM('good', 'bad');--> statement-breakpoint
CREATE TYPE "public"."night_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'PE', 'SA', 'ATA');--> statement-breakpoint
CREATE TABLE "legacy_stats" (
	"player_id" integer PRIMARY KEY NOT NULL,
	"matches" integer NOT NULL,
	"goals" integer NOT NULL,
	"assists" integer NOT NULL,
	"clean_sheets" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_stats_non_negative" CHECK (matches >= 0 and goals >= 0 and assists >= 0),
	CONSTRAINT "legacy_stats_clean_sheets_range" CHECK (clean_sheets is null or clean_sheets between 0 and matches)
);
--> statement-breakpoint
CREATE TABLE "nicknames" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nicknames_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"label" text NOT NULL,
	"tone" "nickname_tone" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"shirt_number" integer NOT NULL,
	"default_position" "position" NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_slug_unique" UNIQUE("slug"),
	CONSTRAINT "players_shirt_number_range" CHECK (shirt_number between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "night_awards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "night_awards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"night_id" integer NOT NULL,
	"award" "award_type" NOT NULL,
	"player_id" integer NOT NULL,
	"value" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "night_awards_night_award_player_key" UNIQUE("night_id","award","player_id")
);
--> statement-breakpoint
CREATE TABLE "nights" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"season_id" integer NOT NULL,
	"reference_date" date NOT NULL,
	"status" "night_status" DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nights_reference_date_unique" UNIQUE("reference_date"),
	CONSTRAINT "nights_closed_at_matches_status" CHECK ((status = 'closed') = (closed_at is not null))
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seasons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"game_edition" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "seasons_date_order" CHECK (ends_on is null or ends_on >= starts_on)
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"position" "position" NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"saves" integer,
	"penalties_saved" integer,
	"rating" numeric(3, 1) NOT NULL,
	"rating_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_players_match_id_player_id_pk" PRIMARY KEY("match_id","player_id"),
	CONSTRAINT "match_players_goals_assists_non_negative" CHECK (goals >= 0 and assists >= 0),
	CONSTRAINT "match_players_saves_only_for_goalkeeper" CHECK (("position" = 'GOL') = (saves is not null)),
	CONSTRAINT "match_players_saves_non_negative" CHECK (saves is null or saves >= 0),
	CONSTRAINT "match_players_penalties_saved_valid" CHECK (penalties_saved is null or (
        "position" = 'GOL' and penalties_saved between 0 and saves
      )),
	CONSTRAINT "match_players_rating_range" CHECK (rating between 3.0 and 10.0)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"night_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"opponent_id" integer NOT NULL,
	"match_type" "match_type",
	"played_at" timestamp with time zone NOT NULL,
	"goals_for" integer NOT NULL,
	"goals_against" integer NOT NULL,
	"went_to_penalties" boolean DEFAULT false NOT NULL,
	"penalty_score_for" integer,
	"penalty_score_against" integer,
	"result" text GENERATED ALWAYS AS (case
          when goals_for > goals_against then 'W'
          when goals_for < goals_against then 'L'
          when went_to_penalties and penalty_score_for > penalty_score_against then 'W'
          when went_to_penalties then 'L'
          else 'D'
        end) STORED NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_sequence_positive" CHECK (sequence >= 1),
	CONSTRAINT "matches_goals_non_negative" CHECK (goals_for >= 0 and goals_against >= 0),
	CONSTRAINT "matches_penalty_scores_presence" CHECK (went_to_penalties = (penalty_score_for is not null)
        and went_to_penalties = (penalty_score_against is not null)),
	CONSTRAINT "matches_penalties_only_after_draw" CHECK (not went_to_penalties or goals_for = goals_against),
	CONSTRAINT "matches_penalty_scores_valid" CHECK (not went_to_penalties or (
        penalty_score_for >= 0
        and penalty_score_against >= 0
        and penalty_score_for <> penalty_score_against
      ))
);
--> statement-breakpoint
CREATE TABLE "nickname_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nickname_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nickname_id" integer NOT NULL,
	"night_id" integer,
	"match_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nickname_assignments_nickname_night_key" UNIQUE("nickname_id","night_id"),
	CONSTRAINT "nickname_assignments_nickname_match_key" UNIQUE("nickname_id","match_id"),
	CONSTRAINT "nickname_assignments_single_target" CHECK (num_nonnulls(night_id, match_id) = 1)
);
--> statement-breakpoint
CREATE TABLE "opponents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opponents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"action" "audit_action" NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
ALTER TABLE "legacy_stats" ADD CONSTRAINT "legacy_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nicknames" ADD CONSTRAINT "nicknames_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_awards" ADD CONSTRAINT "night_awards_night_id_nights_id_fk" FOREIGN KEY ("night_id") REFERENCES "public"."nights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_awards" ADD CONSTRAINT "night_awards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nights" ADD CONSTRAINT "nights_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_night_id_nights_id_fk" FOREIGN KEY ("night_id") REFERENCES "public"."nights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_id_opponents_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."opponents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nickname_assignments" ADD CONSTRAINT "nickname_assignments_nickname_id_nicknames_id_fk" FOREIGN KEY ("nickname_id") REFERENCES "public"."nicknames"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nickname_assignments" ADD CONSTRAINT "nickname_assignments_night_id_nights_id_fk" FOREIGN KEY ("night_id") REFERENCES "public"."nights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nickname_assignments" ADD CONSTRAINT "nickname_assignments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nicknames_player_label_idx" ON "nicknames" USING btree ("player_id",lower("label"));--> statement-breakpoint
CREATE UNIQUE INDEX "players_active_shirt_number_idx" ON "players" USING btree ("shirt_number") WHERE is_active;--> statement-breakpoint
CREATE UNIQUE INDEX "nights_single_open_idx" ON "nights" USING btree ("status") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "match_players_player_idx" ON "match_players" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_single_goalkeeper_idx" ON "match_players" USING btree ("match_id") WHERE "position" = 'GOL';--> statement-breakpoint
CREATE UNIQUE INDEX "matches_night_sequence_idx" ON "matches" USING btree ("night_id","sequence") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "matches_night_idx" ON "matches" USING btree ("night_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opponents_name_idx" ON "opponents" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at");