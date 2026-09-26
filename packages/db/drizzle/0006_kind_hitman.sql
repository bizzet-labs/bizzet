CREATE TYPE "public"."ens_status" AS ENUM('unregistered', 'registered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."receiving_currency" AS ENUM('JPYC', 'USDC');--> statement-breakpoint
CREATE TABLE "ens_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"hq_name" text NOT NULL,
	"subregistry_address" text NOT NULL,
	"resolver_address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "ens_label" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "receiving_currency" "receiving_currency" DEFAULT 'JPYC' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "ens_status" "ens_status" DEFAULT 'unregistered' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "ens_tx_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_ens_label_idx" ON "groups" USING btree ("ens_label");