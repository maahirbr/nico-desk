import type { Metadata } from 'next';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { Avatar } from '@/components/chips';
import { Nav, SignOut, SwitchToOwner } from '@/components/client';
import { TopSearch } from '@/components/TopSearch';
import { rosterFile } from '@/lib/db';
import { localOwnerId } from '@/lib/seed';
import './globals.css';

export const metadata: Metadata = { title: 'nico-desk', description: 'Where a Nicobar team runs its week.' };

const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;550;600&family=JetBrains+Mono:wght@400;500&display=swap';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentMe();
  const ownerId = localOwnerId(rosterFile());
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        {me ? (
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-logo">n</span>
                <span>
                  <span className="mark-name">nico-desk</span>
                  <span className="mark-sub">{me.team.name}</span>
                </span>
              </Link>
              <Nav isAdmin={me.person.appRoles.includes('admin')} isLead={me.person.appRoles.includes('lead')} />
              {ownerId && ownerId !== me.person.id && <SwitchToOwner id={ownerId} viewing={me.person.displayName} />}
              <div className="who">
                <Avatar name={me.person.displayName} />
                <span className="who-text">
                  <div className="who-name">{me.person.displayName}</div>
                  <div className="who-role">{me.person.appRoles.filter((r) => r !== 'member').join(' · ') || 'member'}</div>
                </span>
                <SignOut />
              </div>
            </aside>
            <main className="main"><div className="topbar"><TopSearch /></div><div className="page">{children}</div></main>
          </div>
        ) : (
          <main className="page-solo">{children}</main>
        )}
      </body>
    </html>
  );
}
