CREATE TYPE "public"."app_role" AS ENUM('member', 'lead', 'admin');--> statement-breakpoint
CREATE TYPE "public"."draft_state" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."due_kind" AS ENUM('stated', 'inferred', 'missing');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('task', 'project');--> statement-breakpoint
CREATE TYPE "public"."health" AS ENUM('not_started', 'off_track', 'on_track', 'ahead');--> statement-breakpoint
CREATE TYPE "public"."model_step" AS ENUM('drafter', 'second_pass', 'duplicate_check', 'renegotiation_draft', 'weekly_narrative', 'suggestion', 'ask');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('received', 'drafted', 'failed', 'cleared');--> statement-breakpoint
CREATE TYPE "public"."notice_kind" AS ENUM('due_tomorrow', 'due_today', 'overdue', 'blocked_on_you', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."optin_kind" AS ENUM('monday_digest');--> statement-breakpoint
CREATE TYPE "public"."origin" AS ENUM('app', 'sheet', 'notes');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('on_track', 'at_risk', 'off_track');--> statement-breakpoint
CREATE TYPE "public"."send_channel" AS ENUM('email', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."send_kind" AS ENUM('monday_digest', 'overdue_weekly', 'blocked_ask', 'renegotiation');--> statement-breakpoint
CREATE TYPE "public"."send_state" AS ENUM('draft', 'approved', 'sent', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."status_category" AS ENUM('open', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."team_type" AS ENUM('launch', 'run', 'partner', 'pipeline');--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"title" text NOT NULL,
	"spoken_owner" text,
	"owner_id" text,
	"due_phrase" text,
	"due_on" date,
	"due_kind" "due_kind" NOT NULL,
	"source_quote" text NOT NULL,
	"quote_valid" boolean NOT NULL,
	"critical" boolean NOT NULL,
	"confidence" numeric NOT NULL,
	"duplicate_of" text,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "draft_state" NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"task_id" text,
	CONSTRAINT "drafts_confidence" CHECK ("drafts"."confidence" BETWEEN 0 AND 1),
	CONSTRAINT "drafts_approved_task" CHECK (("drafts"."state" = 'approved') = ("drafts"."task_id" IS NOT NULL)),
	CONSTRAINT "drafts_decided_by" CHECK ("drafts"."state" = 'draft' OR "drafts"."decided_by" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "email_optins" (
	"person_id" text NOT NULL,
	"kind" "optin_kind" NOT NULL,
	"opted_in_at" timestamp with time zone NOT NULL,
	"opted_out_at" timestamp with time zone,
	CONSTRAINT "email_optins_person_id_kind_pk" PRIMARY KEY("person_id","kind")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"field" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"actor_id" text,
	"origin" "origin" NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "events_reason_len" CHECK (char_length("events"."reason") <= 280),
	CONSTRAINT "events_reason_required" CHECK ("events"."field" NOT IN ('due_on','_reopened') OR "events"."reason" IS NOT NULL),
	CONSTRAINT "events_drop_reason" CHECK ("events"."field" <> 'status_category' OR "events"."after" <> '"dropped"'::jsonb OR "events"."reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "model_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"step" "model_step" NOT NULL,
	"model" text NOT NULL,
	"input_hash" text NOT NULL,
	"output" jsonb,
	"confidence" numeric,
	"latency_ms" integer NOT NULL,
	"cost" numeric DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "model_calls_confidence" CHECK ("model_calls"."confidence" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"source_app" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"body" text,
	"held_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"drafted_at" timestamp with time zone,
	"status" "note_status" NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notes_source_app_external_id_unique" UNIQUE("source_app","external_id"),
	CONSTRAINT "notes_paste_ext" CHECK (("notes"."source_app" = 'paste') = ("notes"."external_id" IS NULL)),
	CONSTRAINT "notes_cleared_body" CHECK (("notes"."status" = 'cleared') = ("notes"."body" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"task_id" text NOT NULL,
	"kind" "notice_kind" NOT NULL,
	"for_date" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notices_person_id_task_id_kind_for_date_unique" UNIQUE("person_id","task_id","kind","for_date")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "people_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" "project_status" NOT NULL,
	"status_note" text,
	"status_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sends" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "send_kind" NOT NULL,
	"team_id" text NOT NULL,
	"subject_id" text,
	"task_id" text,
	"triggered_by" text,
	"recipients" text[] NOT NULL,
	"body_snapshot" jsonb NOT NULL,
	"channel" "send_channel" NOT NULL,
	"state" "send_state" NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"provider_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "sends_approved_by" CHECK ("sends"."state" IN ('draft','discarded') OR "sends"."approved_by" IS NOT NULL),
	CONSTRAINT "sends_approval_pair" CHECK (("sends"."approved_by" IS NULL) = ("sends"."approved_at" IS NULL)),
	CONSTRAINT "sends_digest_subject" CHECK ("sends"."kind" <> 'monday_digest' OR ("sends"."subject_id" IS NOT NULL AND "sends"."recipients" = ARRAY["sends"."subject_id"])),
	CONSTRAINT "sends_task_required" CHECK ("sends"."kind" NOT IN ('blocked_ask','renegotiation') OR "sends"."task_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "sheet_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"sheet_id" text NOT NULL,
	"tab_name" text NOT NULL,
	"header_map" jsonb NOT NULL,
	"last_read_at" timestamp with time zone,
	"last_error" text,
	"granted_by" text NOT NULL,
	CONSTRAINT "sheet_sources_sheet_id_tab_name_unique" UNIQUE("sheet_id","tab_name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"first_due_on" date NOT NULL,
	"due_on" date NOT NULL,
	"note" text,
	"health" "health",
	"status" text NOT NULL,
	"status_category" "status_category" NOT NULL,
	"priority" "priority",
	"priority_set_by" text,
	"priority_set_at" timestamp with time zone,
	"blocked_on_id" text,
	"blocked_ask" text,
	"blocked_at" timestamp with time zone,
	"origin" "origin" NOT NULL,
	"origin_ref" text,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_on" date,
	"version" integer DEFAULT 1 NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(note, ''))) STORED,
	CONSTRAINT "tasks_title_len" CHECK (char_length("tasks"."title") BETWEEN 3 AND 200),
	CONSTRAINT "tasks_note_len" CHECK (char_length("tasks"."note") <= 200),
	CONSTRAINT "tasks_blocked_ask_len" CHECK (char_length("tasks"."blocked_ask") BETWEEN 10 AND 280),
	CONSTRAINT "tasks_origin_ref" CHECK (("tasks"."origin" = 'app') = ("tasks"."origin_ref" IS NULL)),
	CONSTRAINT "tasks_done_closed" CHECK (("tasks"."status_category" = 'done') = ("tasks"."closed_at" IS NOT NULL)),
	CONSTRAINT "tasks_closed_pair" CHECK (("tasks"."closed_at" IS NULL) = ("tasks"."closed_on" IS NULL)),
	CONSTRAINT "tasks_priority_pair" CHECK (("tasks"."priority" IS NULL) = ("tasks"."priority_set_by" IS NULL)),
	CONSTRAINT "tasks_blocked_pair" CHECK (("tasks"."blocked_on_id" IS NULL) = ("tasks"."blocked_ask" IS NULL)),
	CONSTRAINT "tasks_open_has_health" CHECK ("tasks"."origin" = 'sheet' OR "tasks"."status_category" <> 'open' OR "tasks"."health" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" text NOT NULL,
	"person_id" text NOT NULL,
	"app_role" "app_role" NOT NULL,
	CONSTRAINT "team_members_team_id_person_id_app_role_pk" PRIMARY KEY("team_id","person_id","app_role")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"team_type" "team_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_duplicate_of_tasks_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_decided_by_people_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_optins" ADD CONSTRAINT "email_optins_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_people_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_subject_id_people_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_triggered_by_people_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_approved_by_people_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sources" ADD CONSTRAINT "sheet_sources_granted_by_people_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_set_by_people_id_fk" FOREIGN KEY ("priority_set_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_blocked_on_id_people_id_fk" FOREIGN KEY ("blocked_on_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_entity" ON "events" USING btree ("entity_type","entity_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_origin_ref" ON "tasks" USING btree ("origin","origin_ref") WHERE "tasks"."origin_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_team_open" ON "tasks" USING btree ("team_id","owner_id","due_on") WHERE "tasks"."status_category" = 'open';--> statement-breakpoint
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_tsv");