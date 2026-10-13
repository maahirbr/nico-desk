import { requireMe } from '@/lib/auth';
import { isLeadOrAdmin } from '@/lib/roles';
import { connectionStatus } from '@/lib/connectors';
import { db } from '@/lib/db';
import { meetEnabled, meetStatus } from '@/lib/meet';
import { Connections } from '@/components/Connections';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ meet?: string }> }) {
  const me = await requireMe();
  const canManage = isLeadOrAdmin(me.person.appRoles) && !me.viewingAs;
  // Google Meet is one lead's own link, and shows only when it is switched on (lib/meet.ts).
  const meet = canManage && meetEnabled() ? await meetStatus(await db(), me.realPerson.id) : null;
  const meetCode = typeof (await searchParams).meet === 'string' ? (await searchParams).meet! : null;
  return <Connections status={connectionStatus()} canManage={canManage} meet={meet} meetCode={meetCode} />;
}
