CREATE TABLE "webhooks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"event_type" varchar(200) NOT NULL,
	"secret_hash" varchar(128) NOT NULL,
	"secret_prefix" varchar(12) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "webhooks_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "data_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"request_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_requests_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhooks_public" ON "webhooks" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_url" ON "webhooks" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_webhooks_active" ON "webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_data_requests_public" ON "data_requests" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_data_requests_student" ON "data_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_data_requests_status" ON "data_requests" USING btree ("status","requested_at");