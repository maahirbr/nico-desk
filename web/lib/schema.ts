// Slice 1 schema from SPEC.md section 3.3, plus the project boards (project meta and the plan_*
// tables). Slice 2 tables are not created yet.

export const SCHEMA = `
SET TIME ZONE 'UTC';

CREATE TABLE teams (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  team_type  text NOT NULL CHECK (team_type IN ('launch','run','partner','pipeline'))
);

CREATE TABLE people (
  id            text PRIMARY KEY,
  display_name  text NOT NULL,
  role          text NOT NULL,
  department    text NOT NULL,
  email         text NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true,
  contact_email text,                          -- where reminders go, if not the sign-in email
  alt_emails    text[] NOT NULL DEFAULT '{}',  -- other addresses that sign in as this person
  never_remind  boolean NOT NULL DEFAULT false, -- e.g. someone who signs off rather than delivers
  photo_url     text,                          -- the Google sign-in photo; an uploaded one (person_photos) wins
  phone         text CHECK (phone ~ '^[0-9 +-]{7,20}$'),  -- optional; shown only to people on the same team
  restricted    boolean NOT NULL DEFAULT false   -- sees only the projects they are on or may view (lib/sight.ts); leads and admins see all
);

-- An uploaded profile photo: a 256px square the browser made, stored here so no storage service is needed.
CREATE TABLE person_photos (
  person_id   text PRIMARY KEY REFERENCES people(id),
  bytes       bytea NOT NULL,
  mime        text NOT NULL CHECK (mime IN ('image/webp','image/jpeg','image/png')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE person_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE team_members (
  team_id    text NOT NULL REFERENCES teams(id),
  person_id  text NOT NULL REFERENCES people(id),
  app_role   text NOT NULL CHECK (app_role IN ('member','lead','admin')),
  PRIMARY KEY (team_id, person_id, app_role)
);

CREATE TABLE projects (
  id          text PRIMARY KEY,
  team_id     text NOT NULL REFERENCES teams(id),
  name        text NOT NULL,
  department  text NOT NULL,
  owner_id    text NOT NULL REFERENCES people(id),  -- project owner: accountable for the outcome
  lead_id     text REFERENCES people(id),           -- project lead: runs it day to day; null when the owner leads it
  status      text NOT NULL CHECK (status IN ('on_track','at_risk','off_track')),
  status_note text,
  status_at   timestamptz NOT NULL,
  -- project page: which board it shows, and its header
  kind           text NOT NULL DEFAULT 'tasks' CHECK (kind IN ('tasks','plan')),
  eyebrow        text,
  phase          text,
  intro          text,
  launch_on      date,
  pills          jsonb NOT NULL DEFAULT '[]',
  pillars        jsonb NOT NULL DEFAULT '[]',
  partner_name   text,
  partner_people jsonb NOT NULL DEFAULT '[]',
  cadence        jsonb NOT NULL DEFAULT '[]',
  workstreams    jsonb NOT NULL DEFAULT '[]',  -- sub-projects inside a task board
  target_label   text,                         -- what the date is: Launch, Go-live, Quarter end
  created_by     text REFERENCES people(id),
  archived_at    timestamptz,                  -- set when the project is closed; null while it is live
  archived_by    text REFERENCES people(id),
  -- meeting rhythm (13 Oct): how often the project meets, the weekday, the next and the last meeting
  meet_every     text CHECK (meet_every IN ('weekly','fortnightly','monthly','as_needed')),
  meet_day       smallint CHECK (meet_day BETWEEN 1 AND 7),  -- ISO weekday, 1 Monday to 7 Sunday
  meet_next      date,
  meet_last      date,
  UNIQUE (team_id, name)
);

CREATE TABLE tasks (
  id               text PRIMARY KEY,
  team_id          text NOT NULL REFERENCES teams(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description      text CHECK (char_length(description) <= 600),  -- what the task is about, in a line or two
  owner_id         text NOT NULL REFERENCES people(id),
  project_id       text REFERENCES projects(id),
  workstream       text CHECK (char_length(workstream) <= 60),
  first_due_on     date NOT NULL,
  due_on           date NOT NULL,
  note             text CHECK (char_length(note) <= 140),
  health           text CHECK (health IN ('not_started','off_track','on_track','ahead')),
  status           text NOT NULL,
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  priority         text CHECK (priority IN ('high','normal','low')),
  priority_set_by  text REFERENCES people(id),
  priority_set_at  timestamptz,
  blocked_on_id    text REFERENCES people(id),
  blocked_ask      text CHECK (char_length(blocked_ask) BETWEEN 1 AND 280),
  blocked_at       timestamptz,
  origin           text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  origin_ref       text,
  created_by       text REFERENCES people(id),
  created_at       timestamptz NOT NULL,
  closed_at        timestamptz,
  version          integer NOT NULL DEFAULT 1,
  CHECK ((origin = 'app') = (origin_ref IS NULL)),
  CHECK ((status_category = 'done') = (closed_at IS NOT NULL)),
  CHECK ((priority IS NULL) = (priority_set_by IS NULL)),
  -- Blocked means a block reason (blocked_ask). Naming a person is optional: not every block is a person.
  CONSTRAINT tasks_block_person_needs_reason CHECK (blocked_on_id IS NULL OR blocked_ask IS NOT NULL),
  CHECK (origin = 'sheet' OR status_category <> 'open' OR health IS NOT NULL)
);
CREATE UNIQUE INDEX tasks_origin_ref ON tasks (origin, origin_ref) WHERE origin_ref IS NOT NULL;
CREATE INDEX tasks_team_open ON tasks (team_id, owner_id, due_on) WHERE status_category = 'open';

CREATE FUNCTION tasks_first_due_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_due_on <> OLD.first_due_on THEN
    RAISE EXCEPTION 'first_due_on is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_first_due_locked BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_first_due_locked();

CREATE TABLE events (
  id          text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('task','project')),
  entity_id   text NOT NULL,
  field       text NOT NULL,
  before      jsonb,
  after       jsonb,
  reason      text CHECK (char_length(reason) <= 280),
  actor_id    text REFERENCES people(id),
  origin      text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  at          timestamptz NOT NULL,
  CHECK (field NOT IN ('due_on','_reopened') OR reason IS NOT NULL),
  CHECK (field <> 'status_category' OR after IS NULL OR after <> '"dropped"'::jsonb OR reason IS NOT NULL)
);
CREATE INDEX events_entity ON events (entity_type, entity_id, at);

CREATE FUNCTION events_append_only() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'events is append-only'; END $$;
CREATE TRIGGER events_no_change BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();

-- What someone has seen in "Updates for you": scope '*' is "mark all seen", else one task id.
CREATE TABLE update_seen (
  person_id  text NOT NULL REFERENCES people(id),
  scope      text NOT NULL,
  seen_at    timestamptz NOT NULL,
  PRIMARY KEY (person_id, scope)
);

-- Comments on a task or a project. @person, #task and #project are stored as ids in comment_refs, not parsed from the text
-- again. A removed comment keeps its row (deleted_at) with an empty body, so the thread still reads "Comment removed".
CREATE TABLE comments (
  id            text PRIMARY KEY,
  subject_kind  text NOT NULL CHECK (subject_kind IN ('task','project')),
  subject_id    text NOT NULL,
  author_id     text NOT NULL REFERENCES people(id),
  body          text NOT NULL CHECK (char_length(body) <= 2000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);
CREATE INDEX comments_subject ON comments (subject_kind, subject_id, created_at);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Pilot feedback sent from inside the app. Any person writes a note, only an admin reads the list. Nothing is emailed.
-- path is an in-app path (no query string), kept only when the person ticked "about this page".
CREATE TABLE feedback (
  id          text PRIMARY KEY,
  person_id   text NOT NULL REFERENCES people(id),
  path        text,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX feedback_created ON feedback (created_at DESC);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE comment_refs (
  comment_id  text NOT NULL REFERENCES comments(id),
  ref_kind    text NOT NULL CHECK (ref_kind IN ('person','task','project')),
  ref_id      text NOT NULL,
  PRIMARY KEY (comment_id, ref_kind, ref_id)
);
ALTER TABLE comment_refs ENABLE ROW LEVEL SECURITY;

-- A 'mentioned' notice has no task: comment_id points at the comment, and the comment at its task or project.
CREATE TABLE notices (
  id          text PRIMARY KEY,
  person_id   text NOT NULL REFERENCES people(id),
  task_id     text REFERENCES tasks(id),
  comment_id  text REFERENCES comments(id),
  kind        text NOT NULL CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned','reassigned_away','mentioned')),
  for_date    date NOT NULL,
  created_at  timestamptz NOT NULL,
  read_at     timestamptz,
  UNIQUE (person_id, task_id, kind, for_date)
);

-- Links on a task (Docs, Sheets, Figma, decks, any web page). The task keeps its own version; a link change is logged as an event.
CREATE TABLE task_links (
  id          text PRIMARY KEY,
  task_id     text NOT NULL REFERENCES tasks(id),
  url         text NOT NULL CHECK (char_length(url) <= 2000),
  label       text CHECK (char_length(label) BETWEEN 1 AND 80),
  created_by  text REFERENCES people(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_links_task ON task_links (task_id, created_at);

-- Plan boards: lines of work with checkpoints, a partner's asks, and actions from meetings.
-- A date moved later counts as a push and keeps the date first given (orig_due_on).

CREATE TABLE plan_lines (
  id             text PRIMARY KEY,
  project_id     text NOT NULL REFERENCES projects(id),
  num            integer NOT NULL,
  pillar         text NOT NULL,
  what           text NOT NULL CHECK (char_length(what) BETWEEN 2 AND 200),
  done_def       text NOT NULL DEFAULT '',
  note           text NOT NULL DEFAULT '' CHECK (char_length(note) <= 160),
  owner_id       text REFERENCES people(id),
  owner_with     text NOT NULL DEFAULT '',
  partner        text NOT NULL DEFAULT '',
  partner_role   text NOT NULL DEFAULT '',
  mode           text NOT NULL DEFAULT 'coaching' CHECK (mode IN ('coaching','hands-on')),
  due_on         date,
  orig_due_on    date,
  push_count     integer NOT NULL DEFAULT 0,
  by_label       text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started','In progress','Blocked','Done')),
  completed_on   date,
  removed        boolean NOT NULL DEFAULT false,
  removed_by     text REFERENCES people(id),
  removed_at     timestamptz,
  remove_reason  text,
  last_date_by   text,
  last_date_at   timestamptz,
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL,
  UNIQUE (project_id, num),
  CHECK ((status = 'Done') = (completed_on IS NOT NULL)),
  CHECK (NOT removed OR remove_reason IS NOT NULL)
);

CREATE TABLE plan_checkpoints (
  id           text PRIMARY KEY,
  line_id      text NOT NULL REFERENCES plan_lines(id) ON DELETE CASCADE,
  label        text NOT NULL,
  due_on       date,
  orig_due_on  date,
  push_count   integer NOT NULL DEFAULT 0,
  done         boolean NOT NULL DEFAULT false,
  done_on      date,
  position     integer NOT NULL DEFAULT 0
);

CREATE TABLE plan_actions (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES projects(id),
  line_id      text REFERENCES plan_lines(id),
  owner_name   text NOT NULL DEFAULT '',
  owner_with   text NOT NULL DEFAULT '',
  task         text NOT NULL,
  due_on       date,
  done         boolean NOT NULL DEFAULT false,
  done_on      date,
  source       jsonb NOT NULL DEFAULT '{}',
  proposal_id  text,
  created_by   text REFERENCES people(id),
  created_at   timestamptz NOT NULL
);

CREATE TABLE plan_asks (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES projects(id),
  short        text NOT NULL,
  text         text NOT NULL,
  owner_name   text NOT NULL DEFAULT '',
  due_on       date,
  checkpoints  jsonb NOT NULL DEFAULT '[]',
  done         boolean NOT NULL DEFAULT false,
  done_on      date,
  position     integer NOT NULL DEFAULT 0
);

CREATE TABLE plan_parked (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects(id),
  text        text NOT NULL,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE plan_proposals (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects(id),
  batch       text NOT NULL,
  position    integer NOT NULL,
  meeting     jsonb NOT NULL,
  owner_name  text NOT NULL DEFAULT '',
  owner_with  text NOT NULL DEFAULT '',
  task        text NOT NULL,
  due_on      date,
  line_id     text REFERENCES plan_lines(id),
  owner_id    text REFERENCES people(id),  -- task boards: the roster person the step names
  workstream  text,
  confidence  text NOT NULL CHECK (confidence IN ('sure','unsure')),
  alt         jsonb NOT NULL DEFAULT '[]',
  why         text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_by  text REFERENCES people(id),
  created_at  timestamptz NOT NULL,
  decided_by  text REFERENCES people(id),
  decided_at  timestamptz
);

CREATE TABLE plan_activity (
  id          text PRIMARY KEY,
  project_id  text NOT NULL REFERENCES projects(id),
  actor_id    text REFERENCES people(id),
  summary     text NOT NULL,
  at          timestamptz NOT NULL
);
CREATE INDEX plan_activity_project ON plan_activity (project_id, at);
CREATE TRIGGER plan_activity_no_change BEFORE UPDATE OR DELETE ON plan_activity
  FOR EACH ROW EXECUTE FUNCTION events_append_only();

-- Who works on a project, and their role in it (e.g. "Packaging POC"). The project owner is in
-- projects.owner_id; members here are everyone else named on the project.
CREATE TABLE project_members (
  project_id    text NOT NULL REFERENCES projects(id),
  person_id     text NOT NULL REFERENCES people(id),
  project_role  text NOT NULL CHECK (char_length(project_role) BETWEEN 2 AND 60),
  PRIMARY KEY (project_id, person_id)
);

-- People who may read a project without being on it. Matters only for a restricted person (people.restricted).
CREATE TABLE project_viewers (
  project_id  text NOT NULL REFERENCES projects(id),
  person_id   text NOT NULL REFERENCES people(id),
  added_by    text REFERENCES people(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, person_id)
);

-- Reminder emails drafted from the app. The app never sends: it opens a draft in the
-- person's own mail and records that a reminder went out.
CREATE TABLE reminders (
  id          text PRIMARY KEY,
  team_id     text NOT NULL REFERENCES teams(id),
  person_id   text NOT NULL REFERENCES people(id),
  sent_by     text NOT NULL REFERENCES people(id),
  channel     text NOT NULL CHECK (channel IN ('gmail','mail_app','copy')),
  subject     text NOT NULL,
  item_count  integer NOT NULL,
  at          timestamptz NOT NULL
);
CREATE INDEX reminders_person ON reminders (team_id, person_id, at);
`;
