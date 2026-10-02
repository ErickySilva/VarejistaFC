CREATE TABLE "account_invites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_invites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"role" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_invites_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "account_invites_role_valid" CHECK (role in ('admin', 'player')),
	CONSTRAINT "account_invites_used_fields_together" CHECK ((used_at is null) = (used_by_user_id is null)),
	CONSTRAINT "account_invites_used_or_revoked" CHECK (used_at is null or revoked_at is null)
);
--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_invites_one_pending_per_player_idx" ON "account_invites" USING btree ("player_id") WHERE used_at is null and revoked_at is null;--> statement-breakpoint
CREATE INDEX "account_invites_player_idx" ON "account_invites" USING btree ("player_id");