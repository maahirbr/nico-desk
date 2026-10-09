import { bad } from './errors';
import { isDate, mondayOf, today } from './time';

// Shared query parsing for the team views.
export function weekParam(v: string | null | undefined, field = 'weekStart'): string {
  if (!v) return mondayOf(today());
  if (!isDate(v) || mondayOf(v) !== v) throw bad('invalid_body', 'Use a Monday as YYYY-MM-DD.', field);
  return v;
}

export function filters(q: URLSearchParams) {
  return { personId: q.get('personId') || undefined, projectId: q.get('projectId') || undefined };
}
