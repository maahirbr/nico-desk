// One rule for "may act as a lead": the lead role or the admin role. The service (lib/service.ts)
// and every page that gates a task action or a lead-only screen call this, so they cannot drift.
// Leadership (15 Nov, the PM's call): oversight and follow-up. Reminders to anyone, the Activity page and the team's
// meeting-tool keys, with no extra power over tasks or projects and no wider view of projects. An admin has all of it.
// 'lead' is the retired team role: kept so old rows still read, never given any more (the Roster offers Member,
// Leadership and Admin); scripts/leads-to-members.ts turns the hosted database's leads into members.
export function mayOversee(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'leadership' || r === 'lead' || r === 'admin') return true;
  return false;
}

export function isLeadOrAdmin(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'lead' || r === 'admin') return true;
  return false;
}
