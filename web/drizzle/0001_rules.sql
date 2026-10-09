-- Hand-written. Holds what Drizzle cannot express (SPEC.local.md sections 3.3 and 3.4).
-- The search_tsv generated column, its GIN index and every CHECK are in 0000_init.sql,
-- so drizzle-kit sees them and does not try to drop them.

-- R7: first_due_on is written once and never changed.
CREATE FUNCTION tasks_first_due_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_due_on IS DISTINCT FROM OLD.first_due_on THEN
    RAISE EXCEPTION 'first_due_on is locked';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER tasks_first_due_locked BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_first_due_locked();--> statement-breakpoint

-- events is append-only (docs/DATA-MODEL.md). TRUNCATE is not blocked: the seed uses it to reset.
CREATE FUNCTION events_append_only() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'events is append-only'; END $$;--> statement-breakpoint
CREATE TRIGGER events_no_change BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();--> statement-breakpoint

-- Outcome is derived from closed_on against first_due_on (C1, C5). One rule for every query.
CREATE VIEW task_outcome AS
SELECT id AS task_id,
  CASE
    WHEN closed_on IS NULL THEN NULL
    WHEN closed_on < first_due_on THEN 'ahead'
    WHEN closed_on = first_due_on THEN 'on_time'
    ELSE 'late'
  END AS outcome
FROM tasks;
