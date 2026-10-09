// Drizzle mirror of the DDL in SPEC.local.md section 3.3. Column names, defaults, nullability,
// unique keys and CHECKs follow the DDL. Enum-like text columns use pgEnum.
// What Drizzle cannot express lives in drizzle/0001_rules.sql: the first_due_on lock, the
// events append-only trigger and the task_outcome view.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const day = (name: string) => date(name, { mode: "string" });

// Enums
export const teamType = pgEnum("team_type", ["launch", "run", "partner", "pipeline"]);
export const appRole = pgEnum("app_role", ["member", "lead", "admin"]);
export const projectStatus = pgEnum("project_status", ["on_track", "at_risk", "off_track"]);
export const health = pgEnum("health", ["not_started", "off_track", "on_track", "ahead"]);
export const statusCategory = pgEnum("status_category", ["open", "done", "dropped"]);
export const priority = pgEnum("priority", ["high", "normal", "low"]);
export const origin = pgEnum("origin", ["app", "sheet", "notes"]);
export const entityType = pgEnum("entity_type", ["task", "project"]);
export const noticeKind = pgEnum("notice_kind", [
  "due_tomorrow",
  "due_today",
  "overdue",
  "blocked_on_you",
  "assigned",
]);
export const noteStatus = pgEnum("note_status", ["received", "drafted", "failed", "cleared"]);
export const dueKind = pgEnum("due_kind", ["stated", "inferred", "missing"]);
export const draftState = pgEnum("draft_state", ["draft", "approved", "rejected"]);
export const optinKind = pgEnum("optin_kind", ["monday_digest"]);
export const sendKind = pgEnum("send_kind", [
  "monday_digest",
  "overdue_weekly",
  "blocked_ask",
  "renegotiation",
]);
export const sendChannel = pgEnum("send_channel", ["email", "in_app"]);
export const sendState = pgEnum("send_state", ["draft", "approved", "sent", "failed", "discarded"]);
export const modelStep = pgEnum("model_step", [
  "drafter",
  "second_pass",
  "duplicate_check",
  "renegotiation_draft",
  "weekly_narrative",
  "suggestion",
  "ask",
]);

// Tables
export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teamType: teamType("team_type").notNull(),
});

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  email: text("email").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id").notNull().references(() => teams.id),
    personId: text("person_id").notNull().references(() => people.id),
    appRole: appRole("app_role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.personId, t.appRole] })],
);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id),
  name: text("name").notNull(),
  department: text("department").notNull(),
  ownerId: text("owner_id").notNull().references(() => people.id),
  status: projectStatus("status").notNull(),
  statusNote: text("status_note"),
  statusAt: ts("status_at").notNull(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull().references(() => teams.id),
    title: text("title").notNull(),
    ownerId: text("owner_id").notNull().references(() => people.id),
    projectId: text("project_id").references(() => projects.id),
    // Written once in the _created event. A trigger in 0001_rules.sql rejects any change.
    firstDueOn: day("first_due_on").notNull(),
    dueOn: day("due_on").notNull(),
    note: text("note"),
    health: health("health"),
    status: text("status").notNull(),
    statusCategory: statusCategory("status_category").notNull(),
    priority: priority("priority"),
    prioritySetBy: text("priority_set_by").references(() => people.id),
    prioritySetAt: ts("priority_set_at"),
    blockedOnId: text("blocked_on_id").references(() => people.id),
    blockedAsk: text("blocked_ask"),
    blockedAt: ts("blocked_at"),
    // The ask (docs/DESIGN-HANDOUT.md 4.3). asked_by_id is who needs it, owner_id is who must answer.
    // ask_state is null exactly when the task is not an ask: asked, accepted or returned.
    askedById: text("asked_by_id").references(() => people.id),
    forTaskId: text("for_task_id").references((): AnyPgColumn => tasks.id),
    askState: text("ask_state"),
    origin: origin("origin").notNull(),
    originRef: text("origin_ref"),
    createdBy: text("created_by").references(() => people.id),
    createdAt: ts("created_at").notNull(),
    closedAt: ts("closed_at"),
    closedOn: day("closed_on"),
    version: integer("version").notNull().default(1),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(note, ''))`,
    ),
  },
  (t) => [
    check("tasks_title_len", sql`char_length(${t.title}) BETWEEN 3 AND 200`),
    check("tasks_note_len", sql`char_length(${t.note}) <= 200`),
    check("tasks_blocked_ask_len", sql`char_length(${t.blockedAsk}) BETWEEN 10 AND 280`),
    check("tasks_origin_ref", sql`(${t.origin} = 'app') = (${t.originRef} IS NULL)`),
    check("tasks_done_closed", sql`(${t.statusCategory} = 'done') = (${t.closedAt} IS NOT NULL)`),
    check("tasks_closed_pair", sql`(${t.closedAt} IS NULL) = (${t.closedOn} IS NULL)`),
    check("tasks_priority_pair", sql`(${t.priority} IS NULL) = (${t.prioritySetBy} IS NULL)`),
    check("tasks_blocked_pair", sql`(${t.blockedOnId} IS NULL) = (${t.blockedAsk} IS NULL)`),
    check("tasks_ask_state", sql`${t.askState} IN ('asked','accepted','returned')`),
    check("tasks_ask_pair", sql`(${t.askState} IS NULL) = (${t.askedById} IS NULL)`),
    check(
      "tasks_open_has_health",
      sql`${t.origin} = 'sheet' OR ${t.statusCategory} <> 'open' OR ${t.health} IS NOT NULL`,
    ),
    uniqueIndex("tasks_origin_ref")
      .on(t.origin, t.originRef)
      .where(sql`${t.originRef} IS NOT NULL`),
    index("tasks_team_open")
      .on(t.teamId, t.ownerId, t.dueOn)
      .where(sql`${t.statusCategory} = 'open'`),
    index("tasks_search_idx").using("gin", t.searchTsv),
  ],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    entityType: entityType("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    actorId: text("actor_id").references(() => people.id),
    origin: origin("origin").notNull(),
    at: ts("at").notNull(),
  },
  (t) => [
    check("events_reason_len", sql`char_length(${t.reason}) <= 280`),
    check(
      "events_reason_required",
      sql`${t.field} NOT IN ('due_on','_reopened') OR ${t.reason} IS NOT NULL`,
    ),
    check(
      "events_drop_reason",
      sql`${t.field} <> 'status_category' OR ${t.after} <> '"dropped"'::jsonb OR ${t.reason} IS NOT NULL`,
    ),
    index("events_entity").on(t.entityType, t.entityId, t.at),
  ],
);

export const notices = pgTable(
  "notices",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id),
    taskId: text("task_id").notNull().references(() => tasks.id),
    kind: noticeKind("kind").notNull(),
    forDate: day("for_date").notNull(),
    createdAt: ts("created_at").notNull(),
    readAt: ts("read_at"),
  },
  (t) => [unique().on(t.personId, t.taskId, t.kind, t.forDate)],
);

export const sheetSources = pgTable(
  "sheet_sources",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull().references(() => teams.id),
    sheetId: text("sheet_id").notNull(),
    tabName: text("tab_name").notNull(),
    headerMap: jsonb("header_map").notNull(),
    lastReadAt: ts("last_read_at"),
    lastError: text("last_error"),
    grantedBy: text("granted_by").notNull().references(() => people.id),
  },
  (t) => [unique().on(t.sheetId, t.tabName)],
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull().references(() => teams.id),
    sourceApp: text("source_app").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    body: text("body"),
    heldAt: ts("held_at").notNull(),
    receivedAt: ts("received_at").notNull(),
    draftedAt: ts("drafted_at"),
    status: noteStatus("status").notNull(),
    synthetic: boolean("synthetic").notNull().default(false),
  },
  (t) => [
    unique().on(t.sourceApp, t.externalId),
    check("notes_paste_ext", sql`(${t.sourceApp} = 'paste') = (${t.externalId} IS NULL)`),
    check("notes_cleared_body", sql`(${t.status} = 'cleared') = (${t.body} IS NULL)`),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id").notNull().references(() => notes.id),
    title: text("title").notNull(),
    spokenOwner: text("spoken_owner"),
    ownerId: text("owner_id").references(() => people.id),
    duePhrase: text("due_phrase"),
    dueOn: day("due_on"),
    dueKind: dueKind("due_kind").notNull(),
    sourceQuote: text("source_quote").notNull(),
    quoteValid: boolean("quote_valid").notNull(),
    critical: boolean("critical").notNull(),
    confidence: numeric("confidence", { mode: "number" }).notNull(),
    duplicateOf: text("duplicate_of").references(() => tasks.id),
    checks: jsonb("checks").notNull().default(sql`'[]'::jsonb`),
    state: draftState("state").notNull(),
    decidedBy: text("decided_by").references(() => people.id),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note"),
    taskId: text("task_id").references(() => tasks.id),
  },
  (t) => [
    check("drafts_confidence", sql`${t.confidence} BETWEEN 0 AND 1`),
    check("drafts_approved_task", sql`(${t.state} = 'approved') = (${t.taskId} IS NOT NULL)`),
    check("drafts_decided_by", sql`${t.state} = 'draft' OR ${t.decidedBy} IS NOT NULL`),
  ],
);

export const emailOptins = pgTable(
  "email_optins",
  {
    personId: text("person_id").notNull().references(() => people.id),
    kind: optinKind("kind").notNull(),
    optedInAt: ts("opted_in_at").notNull(),
    optedOutAt: ts("opted_out_at"),
  },
  (t) => [primaryKey({ columns: [t.personId, t.kind] })],
);

export const sends = pgTable(
  "sends",
  {
    id: text("id").primaryKey(),
    kind: sendKind("kind").notNull(),
    teamId: text("team_id").notNull().references(() => teams.id),
    subjectId: text("subject_id").references(() => people.id),
    taskId: text("task_id").references(() => tasks.id),
    triggeredBy: text("triggered_by").references(() => people.id),
    recipients: text("recipients").array().notNull(),
    bodySnapshot: jsonb("body_snapshot").notNull(),
    channel: sendChannel("channel").notNull(),
    state: sendState("state").notNull(),
    approvedBy: text("approved_by").references(() => people.id),
    approvedAt: ts("approved_at"),
    providerId: text("provider_id"),
    createdAt: ts("created_at").notNull(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    check("sends_approved_by", sql`${t.state} IN ('draft','discarded') OR ${t.approvedBy} IS NOT NULL`),
    check("sends_approval_pair", sql`(${t.approvedBy} IS NULL) = (${t.approvedAt} IS NULL)`),
    check(
      "sends_digest_subject",
      sql`${t.kind} <> 'monday_digest' OR (${t.subjectId} IS NOT NULL AND ${t.recipients} = ARRAY[${t.subjectId}])`,
    ),
    check(
      "sends_task_required",
      sql`${t.kind} NOT IN ('blocked_ask','renegotiation') OR ${t.taskId} IS NOT NULL`,
    ),
  ],
);

export const modelCalls = pgTable(
  "model_calls",
  {
    id: text("id").primaryKey(),
    step: modelStep("step").notNull(),
    model: text("model").notNull(),
    inputHash: text("input_hash").notNull(),
    output: jsonb("output"),
    confidence: numeric("confidence", { mode: "number" }),
    latencyMs: integer("latency_ms").notNull(),
    cost: numeric("cost", { mode: "number" }).notNull().default(0),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [check("model_calls_confidence", sql`${t.confidence} BETWEEN 0 AND 1`)],
);
