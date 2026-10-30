import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { Person } from '@/components/chips';
import { AddPeopleForm, AddPersonForm, PersonControls } from '@/components/client';

export const dynamic = 'force-dynamic';

// The roster, for everyone on the team (the PM's call, 14 Oct). Only an admin sees the buttons that change it and the
// form to add someone; the service refuses anyone else as well (requireAdmin).
export default async function Admin() {
  const me = await requireMe();
  const { people, isAdmin, readOnly } = await lookups(me);
  return (
    <>
      <div className="page-head"><h1>Roster</h1></div>
      <div className="card table-card"><table className="stacked">
        <thead><tr><th>Name</th><th>Job title</th><th>Email</th><th>Access</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className={p.active ? '' : 'closed'}>
              <td><Person name={p.displayName} id={p.id} />{p.nickname && <span className="dim"> ({p.fullName})</span>}</td>
              <td data-label="Title">{p.role}</td>
              <td data-label="Email" className="mono">{p.email}</td>
              <td data-label="Access"><span style={{ textTransform: 'capitalize' }}>{p.active ? p.appRoles.join(' · ') : 'inactive'}</span></td>
              {isAdmin && <td>{!readOnly && <PersonControls self={p.id === me.person.id} person={{ id: p.id, name: p.fullName ?? p.displayName, role: p.role, email: p.email, active: p.active, roles: p.appRoles }} />}</td>}
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
