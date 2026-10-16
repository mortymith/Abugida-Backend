CREATE TABLE "component_feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "component_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" varchar(100) NOT NULL,
	"component_id" varchar(100) NOT NULL,
	"variant" varchar(100),
	"rating" boolean NOT NULL,
	"comment" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_feedback_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "component_feedback" ADD CONSTRAINT "component_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_component_feedback_public" ON "component_feedback" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_component_feedback_screen_component" ON "component_feedback" USING btree ("screen_id","component_id");--> statement-breakpoint
CREATE INDEX "idx_component_feedback_created" ON "component_feedback" USING btree ("created_at");