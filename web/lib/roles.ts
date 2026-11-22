// One rule for "may act as a lead": the lead role or the admin role. The service (lib/service.ts)
// and every page that gates a task action or a lead-only screen call this, so they cannot drift.
// Leadership (15 Nov, the PM's call): oversight and follow-up. Reminders to anyone, the Activity page and the team's
// meeting-tool keys, with no extra power over tasks or projects and no wider view of projects. An admin has all of it.
// 'lead' is the retired team role: kept so old rows still read, never given any more (the Roster offers Member,
// Leadership and Admin). The hosted database's leads were turned into members on 15 Nov.
export function mayOversee(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'leadership' || r === 'lead' || r === 'admin') return true;
  return false;
}

// Partner (20 Nov, the PM's call): someone from an outside company, stored as member + partner. They sign in with their
// own address, see only the projects they are on (no Personal, Team, Roster, Ledger, Reminders, Activity, Feedback or
// one-off tasks), and give tasks only to themselves or their own company's people. Their company is their department.
export function isPartner(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'partner') return true;
  return false;
}

export function isLeadOrAdmin(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'lead' || r === 'admin') return true;
  return false;
}
