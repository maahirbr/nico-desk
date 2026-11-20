import { requireStaff } from '@/lib/auth';
import { mayOversee } from '@/lib/roles';
import { connectionStatus } from '@/lib/connectors';
import { db, scoped } from '@/lib/db';
import { meetEnabled, meetStatus } from '@/lib/meet';
import { Connections } from '@/components/Connections';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ meet?: string }> }) {
  const me = await requireStaff();
  const canManage = mayOversee(me.person.appRoles); // in View as too, as they see it; ViewAsGuard stops changes (15 Nov)
  // Google Meet is each person's own link (anyone, since 15 Nov), and shows only when it is switched on (lib/meet.ts).
  const meet = !me.viewingAs && meetEnabled() ? await meetStatus(scoped(await db(), me.team.id), me.realPerson.id) : null;
  const meetCode = typeof (await searchParams).meet === 'string' ? (await searchParams).meet! : null;
  return <Connections status={connectionStatus()} canManage={canManage} meet={meet} meetCode={meetCode} />;
}
