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
  view_as: 'View as. An admin sees the app as another person sees it. It is read-only, so nothing can be changed.',

  // Reminders
  remind_gmail: 'Opens a draft in your Gmail, from your address. You press Send. The app sends nothing.',
  remind_mail: 'Opens a draft in your mail app. You press Send. The app sends nothing.',
  remind_copy: 'Copies the subject and the text, so you can paste them into any email or chat.',
} as const;

export type HelpTerm = keyof typeof HELP;

// Every term that has help text. The test checks the terms the app must cover against this list.
export const HELP_TERMS = Object.keys(HELP) as HelpTerm[];

export function helpText(term: HelpTerm): string {
  return HELP[term];
}
