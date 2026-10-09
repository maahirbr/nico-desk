ALTER TABLE "tasks" ADD COLUMN "asked_by_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "for_task_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "ask_state" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_asked_by_id_people_id_fk" FOREIGN KEY ("asked_by_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_for_task_id_tasks_id_fk" FOREIGN KEY ("for_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ask_state" CHECK ("tasks"."ask_state" IN ('asked','accepted','returned'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ask_pair" CHECK (("tasks"."ask_state" IS NULL) = ("tasks"."asked_by_id" IS NULL));--> statement-breakpoint

-- Intent: first_due_on stays locked, except while an ask is unanswered (ask_state = 'asked'), when the owner
-- may pick a date as they say yes. It then moves together with due_on to the same value.
CREATE OR REPLACE FUNCTION tasks_first_due_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_due_on IS DISTINCT FROM OLD.first_due_on THEN
    IF OLD.ask_state = 'asked' AND NEW.first_due_on = NEW.due_on THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'first_due_on is locked';
  END IF;
  RETURN NEW;
END $$;
