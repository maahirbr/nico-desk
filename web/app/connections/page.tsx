import { requireMe } from '@/lib/auth';
import { isLeadOrAdmin } from '@/lib/roles';
import { connectionStatus } from '@/lib/connectors';
import { Connections } from '@/components/Connections';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const me = await requireMe();
  const canManage = isLeadOrAdmin(me.person.appRoles);
  return <Connections status={connectionStatus()} canManage={canManage} />;
}
