CREATE TYPE "public"."notification_type" AS ENUM('enrollment', 'payment', 'publish', 'mention', 'system', 'team_invite', 'review');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"link_entity_type" varchar(50),
	"link_entity_public_id" varchar(100),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "notifications_link_check" CHECK (("notifications"."link_entity_type" IS NULL AND "notifications"."link_entity_public_id" IS NULL) OR ("notifications"."link_entity_type" IS NOT NULL AND "notifications"."link_entity_public_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_public" ON "notifications" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_recent" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_type" ON "notifications" USING btree ("user_id","type");