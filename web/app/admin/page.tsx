import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { Person } from '@/components/chips';
import { AddPersonForm, PersonControls } from '@/components/client';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const me = await requireMe();
  const { people, isAdmin, readOnly } = await lookups(me);
  if (!isAdmin) return (<><h1>Roster</h1><p className="lede">Only the team admin can change the roster.</p></>);
  return (
    <>
      <h1>Roster</h1>
      <p className="lede">{me.team.name}. Marking someone inactive keeps their history. Someone on own projects only sees the projects they own, lead, are on or may view, unless they are a lead or an admin.</p>
      <div className="card table-card"><table className="stacked">
        <thead><tr><th>Name</th><th>Job title</th><th>Email</th><th>Access</th><th></th></tr></thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className={p.active ? '' : 'closed'}>
              <td><Person name={p.displayName} id={p.id} /></td>
              <td data-label="Title">{p.role}</td>
              <td data-label="Email" className="mono small">{p.email}</td>
              <td data-label="Access" className="small"><span style={{ textTransform: 'capitalize' }}>{p.active ? p.appRoles.join(' · ') : 'inactive'}</span>{p.active && p.restricted ? ' · own projects only' : ''}</td>
              <td>{!readOnly && <PersonControls id={p.id} active={p.active} roles={p.appRoles} self={p.id === me.person.id} email={p.email} restricted={p.restricted} />}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {!readOnly && (<>
        <h2>Add a person</h2>
        <AddPersonForm teamId={me.team.id} />
      </>)}
    </>
  );
}
