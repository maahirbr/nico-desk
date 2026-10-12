import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Source_Sans_3 } from 'next/font/google';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { Nav, SwitchToOwner } from '@/components/client';
import { KeyboardDismiss } from '@/components/KeyboardDismiss';
import { Shortcuts } from '@/components/Shortcuts';
import { ProfileMenu } from '@/components/ProfileMenu';
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
  return (
    <html lang="en" data-skin={skin} className={`${geist.variable} ${geistMono.variable} ${plexSans.variable} ${plexMono.variable} ${sourceSans.variable} ${fraunces.variable} ${inter.variable}`}>
      <body>
        <KeyboardDismiss />
        <Toaster />
        {me && <Shortcuts />}
        {me ? (
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-logo" aria-hidden>n</span>
                <span className="mark-text">
                  <span className="mark-name">nico-desk</span>
                  <span className="mark-sub">Nicobar</span>
                </span>
              </Link>
              <Nav isAdmin={me.person.appRoles.includes('admin')} isLead={me.person.appRoles.includes('lead')} />
              {ownerId && ownerId !== me.person.id && <SwitchToOwner id={ownerId} viewing={me.person.displayName} />}
              <ProfileMenu name={me.person.displayName} email={me.person.email} isAdmin={me.person.appRoles.includes('admin')} initial={skin}
                role={me.person.appRoles.filter((r) => r !== 'member').join(' · ') || 'member'} />
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
