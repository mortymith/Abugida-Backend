CREATE TABLE "invite_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"email" text,
	"handle" text,
	"token_hash" text NOT NULL,
	"code_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" text,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invite_link_token_hash" ON "invite_link" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invite_link_code_hash" ON "invite_link" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "idx_invite_link_organization_id" ON "invite_link" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invite_link_status" ON "invite_link" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invite_link_handle" ON "invite_link" USING btree ("handle");