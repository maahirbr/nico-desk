import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Source_Sans_3 } from 'next/font/google';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { isLeadOrAdmin } from '@/lib/roles';
import { Avatar } from '@/components/chips';
import { Nav, SignOut, SwitchToOwner } from '@/components/client';
import { KeyboardDismiss } from '@/components/KeyboardDismiss';
import { Shortcuts } from '@/components/Shortcuts';
import { SkinMenu } from '@/components/SkinMenu';
import { SKIN_COOKIE, skinOf } from '@/components/skins';
import { Toaster } from '@/components/toast';
import { TopSearch } from '@/components/TopSearch';
import { ReadOnlyProvider } from '@/components/readonly';
import { ViewAsMenu, ViewBanner } from '@/components/ViewAs';
import { db, rosterFile } from '@/lib/db';
import { listPeople } from '@/lib/service';
import { localOwnerId } from '@/lib/seed';
import './tokens.css';
import './globals.css';

export const metadata: Metadata = { title: 'nico-desk', description: 'Where a Nicobar team runs its week.' };

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
// Skin W (the default) takes its headings from Fraunces and its text from Inter. Skins B and C bring their own type. The B and C faces load only when a page uses them.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap', preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap', preload: false });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans', display: 'swap', preload: false });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentMe();
  const skin = skinOf((await cookies()).get(SKIN_COOKIE)?.value);
  const ownerId = localOwnerId(rosterFile());
  // "View as" is for admins only, judged on the real session person, never on the person being viewed.
  const realAdmin = !!me && me.realPerson.appRoles.includes('admin');
  const roleWord = (roles: string[]) => roles.filter((r) => r !== 'member').join(' · ') || 'member';
  const viewPeople = realAdmin && me
    ? (await listPeople(await db(), me.team.id)).filter((p) => p.active && p.id !== me.realPerson.id)
        .map((p) => ({ id: p.id, name: p.displayName, roles: roleWord(p.appRoles) }))
    : [];
  return (
    <html lang="en" data-skin={skin} className={`${geist.variable} ${geistMono.variable} ${plexSans.variable} ${plexMono.variable} ${sourceSans.variable} ${fraunces.variable} ${inter.variable}`}>
      <body data-viewing={me?.viewingAs ? '1' : undefined}>
        {me?.viewingAs && <ViewBanner name={me.person.displayName} role={roleWord(me.person.appRoles)} />}
        <KeyboardDismiss />
        <Toaster />
        {me && <Shortcuts />}
        {me ? (
          <ReadOnlyProvider readOnly={me.viewingAs}>
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-logo" aria-hidden>n</span>
                <span className="mark-text">
                  <span className="mark-name">nico-desk</span>
                  <span className="mark-sub">{me.team.name}</span>
                </span>
              </Link>
              <Nav isAdmin={me.person.appRoles.includes('admin')} isLead={isLeadOrAdmin(me.person.appRoles)} />
              {!me.viewingAs && ownerId && ownerId !== me.person.id && <SwitchToOwner id={ownerId} viewing={me.person.displayName} />}
              <div className="who">
                <Avatar name={me.person.displayName} you />
                <span className="who-text">
                  <div className="who-name">{me.person.displayName}</div>
                  <div className="who-role">{roleWord(me.person.appRoles)}</div>
                </span>
                {realAdmin && <ViewAsMenu people={viewPeople} viewingId={me.viewingAs ? me.person.id : null} />}
                <SkinMenu initial={skin} />
                <SignOut />
              </div>
            </aside>
            <main className="main"><div className="topbar"><TopSearch /></div><div className="page">{children}</div></main>
          </div>
          </ReadOnlyProvider>
        ) : (
          <main className="page-solo">{children}</main>
        )}
      </body>
    </html>
  );
}
