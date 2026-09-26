CREATE TYPE "public"."invitation_kind" AS ENUM('member', 'add_passkey', 'add_password');--> statement-breakpoint
CREATE TYPE "public"."safe_transaction_kind" AS ENUM('payout', 'owner_change', 'safe_setup');--> statement-breakpoint
CREATE TYPE "public"."safe_transaction_status" AS ENUM('open', 'submitted', 'executed', 'rejected');--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"group_id" text NOT NULL,
	"safe_address" text NOT NULL,
	"token" text NOT NULL,
	"amount" text NOT NULL,
	"from" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" text NOT NULL,
	"block_timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_cursors" (
	"key" text PRIMARY KEY NOT NULL,
	"block_number" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safe_transaction_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"member_id" text NOT NULL,
	"signer" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safe_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"safe_address" text NOT NULL,
	"kind" "safe_transaction_kind" NOT NULL,
	"to" text NOT NULL,
	"value" text DEFAULT '0' NOT NULL,
	"data" text DEFAULT '0x' NOT NULL,
	"operation" integer DEFAULT 0 NOT NULL,
	"nonce" integer NOT NULL,
	"safe_tx_hash" text NOT NULL,
	"token" text,
	"amount" text,
	"recipient" text,
	"target_member_id" text,
	"description" text,
	"status" "safe_transaction_status" DEFAULT 'open' NOT NULL,
	"created_by" text NOT NULL,
	"tx_hash" text,
	"executed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safe_transactions_safe_tx_hash_unique" UNIQUE("safe_tx_hash")
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "safe_address" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "safe_owners" jsonb;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "safe_threshold" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "safe_salt_nonce" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "safe_deployed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "kind" "invitation_kind" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transaction_signatures" ADD CONSTRAINT "safe_transaction_signatures_transaction_id_safe_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."safe_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transaction_signatures" ADD CONSTRAINT "safe_transaction_signatures_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transactions" ADD CONSTRAINT "safe_transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transactions" ADD CONSTRAINT "safe_transactions_target_member_id_members_id_fk" FOREIGN KEY ("target_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transactions" ADD CONSTRAINT "safe_transactions_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deposits_group_idx" ON "deposits" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "safe_transaction_signatures_member_idx" ON "safe_transaction_signatures" USING btree ("transaction_id","member_id");--> statement-breakpoint
CREATE INDEX "safe_transactions_group_idx" ON "safe_transactions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "safe_transactions_safe_nonce_idx" ON "safe_transactions" USING btree ("safe_address","nonce");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_safe_address_unique" UNIQUE("safe_address");