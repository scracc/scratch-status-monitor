CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "api_tokens_rate_limit_per_minute_check" CHECK ("api_tokens"."rate_limit_per_minute" > 0)
);
--> statement-breakpoint
CREATE TABLE "history_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"monitor_id" uuid NOT NULL,
	"status" text NOT NULL,
	"status_code" integer,
	"response_time" integer NOT NULL,
	"error_message" text,
	"recorded_at" timestamp with time zone NOT NULL,
	"bucketed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "history_records_status_check" CHECK ("history_records"."status" in ('up', 'degraded', 'down', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "status_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_api_tokens_active_expires" ON "api_tokens" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "idx_api_tokens_last_used" ON "api_tokens" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "idx_history_monitor_recorded" ON "history_records" USING btree ("monitor_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_history_bucketed" ON "history_records" USING btree ("bucketed_at");--> statement-breakpoint
CREATE INDEX "idx_history_recorded" ON "history_records" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_history_unique_monitor_recorded" ON "history_records" USING btree ("monitor_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_status_cache_expires" ON "status_cache" USING btree ("expires_at");