// All help-mode text, in one place. Each term has a short tooltip in plain words: short sentences,
// no jargon. HelpMode.tsx shows these when help mode is on. Edit the words here and nowhere else.

export const HELP_COOKIE = 'nd_help';

// The cookie holds "1" when help mode is on. Anything else, or no cookie, means off.
export function helpOf(value: string | undefined | null): boolean {
  return value === '1';
}

export const HELP = {
  // The five statuses a person picks
  status_todo: 'Not started. No work has begun on this task.',
  status_doing: 'In progress. Someone is working on this task.',
  status_blocked: 'Blocked. Work has stopped. The reason is on the task. A blocked task close to its date counts as at risk.',
  status_done: 'Done. The task is finished. Whether it was on time depends on the date first given.',
  status_dropped: 'Dropped. The team chose not to do this task. The reason stays on record.',

  // Flags the app works out from the dates
  late: 'Late. The date has passed and the task is not done, or it was finished after the date first given.',
  at_risk: 'At risk. The date is close and the task has not started, or it is blocked.',
  ahead: 'Ahead. The task was finished before the date first given.',
  on_time: 'On time. The task was finished by the date first given.',

  // Kinds of late, and the record built from them
  flagged_early: 'Flagged early. The task finished late, but the owner moved the date on or before the date first given. The team knew in time.',
  missed: 'Missed. The task finished late, and the date passed before anyone moved it.',
  on_time_record: 'The on-time record shows how often a person finishes by the date first given. Moving a date does not change it.',
  slipped_silently: 'Slipped silently. The task is open and past due, or its date was moved after the old one had passed. No one said in time. The goal is 0.',

  // Ledger tiles
  ledger_kept: 'Tasks finished on or before the date first given, as a share of all tasks finished. Click to see them.',
  ledger_closed_ok: 'Tasks finished by the date first given, or before it. Click to see them.',
  ledger_closed_late: 'Tasks finished after the date first given, even if a moved date was met. Click to see them.',
  ledger_pastdue: 'Tasks that are not done, where today is after the current date. Click to see them.',

  // Dates, blocks, people
  moved_date: 'Moved date. The date was changed after it was first given. Each move needs a reason. The first date stays on record.',
  moved_in_time: 'Moved in time. The new date was logged on or before the date it replaced.',
  blocked_on: 'Blocked on. The task cannot go on until this is sorted out. The person it waits on can clear the block.',
  project_owner: 'Project owner. The person accountable for the project. They, the project lead, and any team lead or admin, can change it and add people to it.',
  project_lead: 'Project lead. The person who runs the project day to day. When no separate lead is set, the owner is the lead.',
  sounds: 'Sounds. Plays a short, quiet tone for a new notice, for a task marked Done and for an action the app refused. Off until you switch it on. The reduced motion setting does not turn it off.',
  view_as: 'View as. An admin sees the app as another person sees it. It is read-only, so nothing can be changed.',

  // Home
  group_today: 'Today. Open tasks that are due today.',
  group_this_week: 'This week. Open tasks due in the week, up to Sunday.',
  group_later: 'Later. Open tasks due after this week.',
  overdue: 'Overdue. The date has passed and the task is not done.',
  waiting_on_you: 'Waiting on you. Someone else is blocked until you do something. A block stays here until it is cleared.',
  updates_for_you: 'Updates for you. Changes to your tasks and projects since you last looked, such as a new owner or a moved date.',
  mark_seen: 'Mark seen. Removes the update from this list on every device. The change stays in the update log.',
  waiting_done: 'Done. Clears the block on this task. You write a few words on what you did, and the owner sees them.',
  your_projects: 'Your projects. The projects where you are the owner, the lead, or a member.',
  done_this_week: 'Done this week. Tasks finished since Monday. The task finished most recently is on top.',

  // Team
  team_by_person: 'By person. One group for each person, with their open tasks.',
  team_by_status: 'By status. One group for each status, with everyone\'s tasks in it.',
  coming_up: 'Coming up. Open tasks due after this week.',

  // Projects
  project_on_track: 'On track. The project owner or lead set this status. The app does not work it out from the dates.',
  project_at_risk: 'At risk. The project owner or lead set this status, because the project may miss its goal. The app does not work it out from the dates.',
  project_off_track: 'Off track. The project owner or lead set this status, because the project will miss its goal. The app does not work it out from the dates.',
  project_archived: 'Archived. A closed project with no open tasks. Its history stays on record. The owner, the lead or an admin can restore it.',
  project_internal: 'Internal. A project run by our own team.',
  project_partner: 'Partner or collaboration. A project run with people outside the team. It has a plan with lines of work.',
  project_progress: 'Progress. How the tasks, or the plan lines, split by status. A late one counts as late only, so the parts add up to the total. Dropped tasks are left out.',

  // Task board
  tile_open: 'Open. Tasks that are not done and not dropped.',
  pushed: 'Pushed. The date was moved later. The number shows how many times. The first date stays on record.',

  // Plan board
  plan_status: 'Status of the line: Not started, In progress, Blocked or Done. A blocked or reopened line needs a reason.',
  plan_pending: 'Pending. No person is named yet. Someone must take this on.',
  plan_hands_on: 'Hands-on. Our team does the work on this line.',
  plan_coaching: 'Coaching. The partner does the work and our team guides them.',
  plan_checkpoints: 'Checkpoints. Smaller dates inside a line. The next open checkpoint is the due date of the line.',
  plan_done_looks_like: 'Done looks like. What must be true for this line to count as finished.',
  plan_actions: 'Actions from meetings. Next steps taken from meeting minutes and tied to this line.',
  plan_by_subproject: 'By sub-project. Groups the lines by the part of the project they belong to.',
  plan_by_date: 'By date. One list of lines, with the one due soonest first.',
  plan_asks: 'Asks. What the partner needs from us. Tick each one off as it happens.',
  plan_ongoing: 'Ongoing. This ask has no end date.',
  plan_parked: 'Parked, by choice. Work the team decided not to do for now. It is not late and not dropped.',
  proposals: 'Proposed actions. Next steps the app read from meeting minutes. Nothing becomes a task until a person accepts it.',
  proposal_sure: 'Sure. The app is confident about the line, owner and date it read from the minutes. You can still change it.',
  proposal_unsure: 'Not sure. The app could not tell the line, the owner or the date from the minutes. Check it before you accept.',
  proposal_accept_sure: 'Accepts every proposal marked sure in one step. The ones that are not sure stay for you to check.',
  paste_review: 'Proposals from a pasted chat. Each one shows what the chat said and the change it would make. Nothing is written until you approve it.',
  paste_masked: 'Names, emails, phone numbers and project names are masked before the chat leaves the server. The pasted text is dropped after review and is not stored.',

  // Person page
  done_ahead: 'Done ahead. Tasks this person finished before the date first given.',
  done_on_time: 'Done on time. Tasks this person finished by the date first given.',
  done_late: 'Done late. Tasks this person finished after the date first given.',
  open_past_due: 'Open and past due. Tasks that are not done, where today is after the current date.',
  date_moves: 'Date moves. How many times this person moved a date. Each move has a reason on record.',
  recent_updates: 'Recent updates. The latest changes to this person\'s tasks, newest first.',

  // Chips and menus
  priority: 'Priority. High, normal or low. A lead sets it, to show which tasks matter most.',
  unblock: 'Unblock. Clears the block and sets the task to In progress. A short note is optional for the owner.',
  move_date: 'Move date. Changes the due date. A reason is needed, and the first date stays on record.',
  reassign: 'Reassign. Gives the task to another person. The old owner gets a notice. Only leads and admins can do this.',

  // Ledger
  delivery_habits: 'Delivery habits. One card for each person, showing how they keep their dates over the period.',
  needs_attention: 'Needs attention. Open tasks that are late, have slipped, or are blocked. The most urgent are first.',
  moved_late: 'Moved late. The new date was logged after the date it replaced had passed.',

  // Reminders
  remind_gmail: 'Opens a draft in your Gmail, from your address. You press Send. The app sends nothing.',
  remind_mail: 'Opens a draft in your mail app. You press Send. The app sends nothing.',
  remind_copy: 'Copies the subject and the text, so you can paste them into any email or chat.',
  // Comments
  comment_box: 'Write a note for everyone who can see this. Type @ to mention a person. Type # to link a task or a project.',
  comment_mention: 'A mention adds a notice for that person. People who cannot see this item are not told.',
  comment_urgent: 'Opens a draft in your Gmail for each person you mentioned. You press Send. The app sends nothing.',
  // Connections
  conn_from_env: 'From the server environment. This key is set where the app is hosted, not in this page. Change it in the hosting settings.',
  conn_meet: 'Google Meet. Read only. The app lists your meetings and reads their notes and transcripts. It cannot change anything, send mail or open your other files. Disconnect ends the link.',

  // Jev suggestions
  jev_order: 'Order. By date is the default. Suggested also reads the words of each task. It is a suggestion. Nothing changes on your tasks.',
  jev_health: 'Suggested health. A reading of the last two weeks of updates and comments. It is a suggestion and is not stored. The status above is set by a person.',
  jev_check_drafts: 'Check drafts. Notes how clear each draft is and whether an open task may repeat it. Owner and date are still checked by the app. Nothing is changed.',
  jev_project_guess: 'Suggested project. Picked from the projects you can add to, by the words of the title. It fills in only while the project is empty.',
  // Search
  search_filters: 'Filters. Add is:late, is:blocked, is:done or is:mine for status. Add @name for an owner, #project for a project, and due:today or due:week for dates.',
  search_commands: 'Commands. Actions that already exist in the app, such as New task or Go to Team. Press Enter to run the one that is lit.',
  // Feedback
  feedback_page: 'Page. Which screen your note is about, if it is about one. Pick it from the list, or leave it.',
  feedback_read: 'Mark read. Shows everyone an admin has seen this note. The note stays on the list.',
  search_recent: 'Recent searches. Kept in this browser for you only. Clear removes them.',
  // Meetings
  meeting_rhythm: 'Meeting rhythm. How often this project meets, and the next date. As needed has no automatic date. The project owner, its lead, a team lead or an admin can change it.',
  meeting_agenda: 'Agenda. The app builds it from the board. It lists what is late, blocked or at risk, what is due before the next meeting, open asks, and what changed since the last meeting.',
  meeting_held: 'Meeting held. Records today as the last meeting and moves the next date on. You can do it once a day.',
} as const;

export type HelpTerm = keyof typeof HELP;

// Every term that has help text. The test checks the terms the app must cover against this list.
export const HELP_TERMS = Object.keys(HELP) as HelpTerm[];

export function helpText(term: HelpTerm): string {
  return HELP[term];
}
