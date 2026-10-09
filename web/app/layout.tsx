import type { Metadata } from 'next';
import { Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Source_Sans_3 } from 'next/font/google';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { Avatar } from '@/components/chips';
import { Nav, SignOut, SwitchToOwner } from '@/components/client';
import { KeyboardDismiss } from '@/components/KeyboardDismiss';
import { Shortcuts } from '@/components/Shortcuts';
import { SkinMenu } from '@/components/SkinMenu';
import { SKIN_COOKIE, skinOf } from '@/components/skins';
import { Toaster } from '@/components/toast';
import { TopSearch } from '@/components/TopSearch';
import { rosterFile } from '@/lib/db';
import { localOwnerId } from '@/lib/seed';
import './tokens.css';
import './globals.css';

export const metadata: Metadata = { title: 'nico-desk', description: 'Where a Nicobar team runs its week.' };

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
// Skins B and C bring their own type. They load only when a page uses them.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap', preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap', preload: false });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans', display: 'swap', preload: false });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentMe();
  const skin = skinOf((await cookies()).get(SKIN_COOKIE)?.value);
  const ownerId = localOwnerId(rosterFile());
  return (
    <html lang="en" data-skin={skin} className={`${geist.variable} ${geistMono.variable} ${plexSans.variable} ${plexMono.variable} ${sourceSans.variable}`}>
      <body>
        <KeyboardDismiss />
        <Toaster />
        {me && <Shortcuts />}
        {me ? (
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-name">nico-desk</span>
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
                <SkinMenu initial={skin} />
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
