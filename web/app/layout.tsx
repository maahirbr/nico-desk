import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { Avatar } from '@/components/chips';
import { Nav, SignOut, SwitchToOwner } from '@/components/client';
import { KeyboardDismiss } from '@/components/KeyboardDismiss';
import { TopSearch } from '@/components/TopSearch';
import { db, rosterFile } from '@/lib/db';
import { listPeople } from '@/lib/service';
import { today } from '@/lib/time';
import { localOwnerId } from '@/lib/seed';
import './tokens.css';
import './globals.css';

export const metadata: Metadata = { title: 'nico-desk', description: 'Where a Nicobar team runs its week.' };

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentMe();
  const ownerId = localOwnerId(rosterFile());
  // The commit field in the top search matches "ask <name> to ..." against the active roster.
  const roster = me ? (await listPeople(await db(), me.team.id)).filter((p) => p.active).map((p) => ({ id: p.id, name: p.displayName })) : [];
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <KeyboardDismiss />
        {me ? (
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-name">nico-desk<span className="mark-v">v2</span></span>
                <span className="mark-sub">{me.team.name}</span>
              </Link>
              <Nav isAdmin={me.person.appRoles.includes('admin')} isLead={me.person.appRoles.includes('lead')} />
              {ownerId && ownerId !== me.person.id && <SwitchToOwner id={ownerId} viewing={me.person.displayName} />}
              <div className="who">
                <Avatar name={me.person.displayName} you />
                <span className="who-text">
                  <div className="who-name">{me.person.displayName}</div>
                  <div className="who-role">{me.person.appRoles.filter((r) => r !== 'member').join(' · ') || 'member'}</div>
                </span>
                <SignOut />
              </div>
            </aside>
            <main className="main"><div className="topbar"><TopSearch people={roster} meId={me.person.id} todayIso={today()} /></div><div className="page">{children}</div></main>
          </div>
        ) : (
          <main className="page-solo">{children}</main>
        )}
      </body>
    </html>
  );
}
