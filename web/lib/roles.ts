// One rule for "may act as a lead": the lead role or the admin role. The service (lib/service.ts)
// and every page that gates a task action or a lead-only screen call this, so they cannot drift.
// blockTask is the exception on purpose: it stays owner-only.
export function isLeadOrAdmin(roles: Iterable<string>): boolean {
  for (const r of roles) if (r === 'lead' || r === 'admin') return true;
  return false;
}
