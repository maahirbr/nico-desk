import { requireMe } from '@/lib/auth';
import { connectionStatus } from '@/lib/connectors';
import { Connections } from '@/components/Connections';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const me = await requireMe();
  const canManage = me.person.appRoles.includes('lead') || me.person.appRoles.includes('admin');
  return <Connections status={connectionStatus()} canManage={canManage} />;
}
