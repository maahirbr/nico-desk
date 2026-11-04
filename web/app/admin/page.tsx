import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { Person } from '@/components/chips';
import { fmtDate, istDate } from '@/lib/time';
import { teamAdoption } from '@/lib/activity';
import { AddPeopleForm, AddPersonForm, PersonControls } from '@/components/client';

export const dynamic = 'force-dynamic';

// The roster, for everyone on the team (the PM's call, 14 Oct). Only an admin sees the buttons that change it and the
// form to add someone; the service refuses anyone else as well (requireAdmin).
export default async function Admin() {
  const me = await requireMe();
  const { d, people, isAdmin, readOnly, names } = await lookups(me);
  // Why someone was removed, when and by whom: admins only (3 Nov).
  const { rows: removed } = isAdmin ? await d.query<{ id: string; removed_reason: string | null; removed_at: string | Date | null; removed_by: string | null }>(
    `SELECT id, removed_reason, removed_at, removed_by FROM people WHERE removed_at IS NOT NULL`) : { rows: [] };
  const why = new Map(removed.map((r) => [r.id, r]));
  // Email invite only for people who have never signed in (the same test as Activity's "Never signed in", 4 Nov).
  const notYet = new Set(isAdmin ? (await teamAdoption(d, me.team.id)).filter((r) => r.status === 'never').map((r) => r.id) : []);
  return (
    <>
      <div className="page-head"><h1>Roster</h1></div>
      <div className="card table-card"><table className="stacked roster">
        {/* Access (member, lead, admin, removed) is for admins only (the PM's call, 3 Nov). */}
        <thead><tr><th>Name</th><th>Job title</th><th>Department</th><th>Email</th>{isAdmin && <><th>Access</th><th></th></>}</tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className={p.active ? '' : 'closed'}>
              <td><Person name={p.displayName} id={p.id} />{p.nickname && <span className="dim"> ({p.fullName})</span>}{!p.active && <span className="dim"> (inactive)</span>}</td>
              <td data-label="Job title">{p.role}</td>
              <td data-label="Department">{p.department}</td>
              <td data-label="Email" className="roster-email">{p.email}</td>
              {isAdmin && <td data-label="Access"><span>{!p.active ? 'Removed' : p.appRoles.includes('admin') ? 'Admin' : p.appRoles.includes('lead') ? 'Lead' : 'Member'}</span>
                {!p.active && why.get(p.id) && (() => { const r = why.get(p.id)!; return (
                  <div className="small dim">{[r.removed_reason, r.removed_at ? fmtDate(istDate(new Date(r.removed_at).toISOString())) : '', r.removed_by ? `by ${(names[r.removed_by] ?? '').split(' ')[0]}` : ''].filter(Boolean).join(' · ')}</div>
                ); })()}
              </td>}
              {isAdmin && <td>{!readOnly && <PersonControls self={p.id === me.person.id} me={me.person.displayName} invite={notYet.has(p.id)} others={people.filter((o) => o.active && o.id !== p.id).map((o) => ({ id: o.id, name: o.fullName ?? o.displayName }))} person={{ id: p.id, name: p.fullName ?? p.displayName, role: p.role, department: p.department, email: p.email, active: p.active, roles: p.appRoles }} />}</td>}
            </tr>
          ))}
        </tbody>
      </table></div>
      {isAdmin && !readOnly && (<>
        <h2>Add a person</h2>
        <AddPersonForm teamId={me.team.id} />
        <h2>Add several people</h2>
        <AddPeopleForm teamId={me.team.id} />
      </>)}
    </>
  );
}
