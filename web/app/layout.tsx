import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Source_Sans_3 } from 'next/font/google';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { currentMe } from '@/lib/auth';
import { mayReadActivity } from '@/lib/activity';
import { isLeadOrAdmin } from '@/lib/roles';
import { FeedbackLink, Nav, SwitchToOwner } from '@/components/client';
import { HELP_COOKIE, helpOf } from '@/components/help';
import { HelpProvider, HelpToggle } from '@/components/HelpMode';
import { KeyboardDismiss } from '@/components/KeyboardDismiss';
import { LimitNotice } from '@/components/LimitNotice';
import { MainScroll } from '@/components/MainScroll';
import { ServiceWorker } from '@/components/ServiceWorker';
import { Shortcuts } from '@/components/Shortcuts';
import { ProjectPeopleProvider } from '@/components/OwnerPicker';
import { ProfileMenu } from '@/components/ProfileMenu';
import { SKIN_COOKIE, skinOf } from '@/components/skins';
import { THEME_COOKIE, themeAttr, themeOf } from '@/components/theme';
import { Toaster } from '@/components/toast';
import { TopSearch } from '@/components/TopSearch';
import { ReadOnlyProvider } from '@/components/readonly';
import { JevProvider } from '@/components/jevFlag';
import { jevOn } from '@/lib/jev';
import { ViewerProvider } from '@/components/viewer';
import { ViewBanner } from '@/components/ViewAs';
import { db, rosterFile, scoped } from '@/lib/db';
import { freshFor } from '@/lib/page';
import { projectPeopleMap, projectsMayAddTo } from '@/lib/plan';
import { seesProject } from '@/lib/sight';
import { sightFor } from '@/lib/visibility';
import { listPeople, teamPhotos } from '@/lib/service';
import { PhotoProvider } from '@/components/Avatar';
import { localOwnerId } from '@/lib/seed';
import { today as todayIst } from '@/lib/time';
import './tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'NicoDesk',
  description: 'Where a Nicobar team runs its week.',
  // Home-screen install: iOS reads these tags, Android reads app/manifest.ts.
  appleWebApp: { capable: true, title: 'NicoDesk', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
// Browser bar colour: skin W canvas, day and night.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f2ec' },
    { media: '(prefers-color-scheme: dark)', color: '#12110f' },
  ],
};

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
  const jar = await cookies();
  const skin = skinOf(jar.get(SKIN_COOKIE)?.value);
  const theme = themeOf(jar.get(THEME_COOKIE)?.value);
  const help = helpOf(jar.get(HELP_COOKIE)?.value); // like the skin: read here so the server HTML already shows help mode
  const ownerId = localOwnerId(rosterFile());
  // "View as" is for admins only, judged on the real session person, never on the person being viewed.
  const realAdmin = !!me && me.realPerson.appRoles.includes('admin');
  const roleWord = (roles: string[]) => roles.filter((r) => r !== 'member').join(' · ') || 'member';
  const d = me ? scoped(await db(), me.team.id) : null;
  const viewPeople = realAdmin && me && d
    ? (await listPeople(d, me.team.id)).filter((p) => p.active && p.id !== me.realPerson.id)
        .map((p) => ({ id: p.id, name: p.displayName, roles: roleWord(p.appRoles) }))
    : [];
  const sight = me && d ? await sightFor(d, me) : null;
  const projectPeople = me && d && sight ? Object.fromEntries(Object.entries(await projectPeopleMap(d, me.team.id)).filter(([id]) => seesProject(sight, id))) : {};
  const mayAddTo = me && d && sight ? (await projectsMayAddTo(d, me.team.id, me.person.id, isLeadOrAdmin(me.person.appRoles))).filter((id) => seesProject(sight, id)) : [];
  const fresh = me && d ? await freshFor(me, d) : {};
  const photos = me && d ? await teamPhotos(d, me.team.id) : {};
  return (
    <html lang="en" data-skin={skin} data-theme={themeAttr(theme)} className={`${geist.variable} ${geistMono.variable} ${plexSans.variable} ${plexMono.variable} ${sourceSans.variable} ${fraunces.variable} ${inter.variable}`}>
      <body data-viewing={me?.viewingAs ? '1' : undefined}>
        <HelpProvider initial={help} enabled={!!me}>
        {me?.viewingAs && <ViewBanner name={me.person.displayName} role={roleWord(me.person.appRoles)} />}
        <KeyboardDismiss />
        <ServiceWorker />
        <LimitNotice />
        <Toaster />
        {me && <Shortcuts />}
        {me ? (
          <ReadOnlyProvider readOnly={me.viewingAs}>
          <JevProvider on={jevOn()}>
          <PhotoProvider photos={photos}>
          <ViewerProvider meId={me.person.id} isLead={isLeadOrAdmin(me.person.appRoles)} today={todayIst()} fresh={fresh}>
          <MainScroll />
          <div className="shell">
            <aside className="side">
              <Link className="mark" href="/me">
                <span className="mark-logo" aria-hidden>n</span>
                <span className="mark-text">
                  <span className="mark-name">NicoDesk</span>
                  <span className="mark-sub mark-wordmark" role="img" aria-label="Nicobar" />
                </span>
              </Link>
              <Nav isAdmin={me.person.appRoles.includes('admin')} isLead={isLeadOrAdmin(me.person.appRoles)} activity={mayReadActivity(me)} />
              {!me.viewingAs && ownerId && ownerId !== me.person.id && <SwitchToOwner id={ownerId} viewing={me.person.displayName} />}
              <ProfileMenu meId={me.person.id} name={me.person.displayName} email={me.person.email} role={roleWord(me.person.appRoles)} initial={skin} initialTheme={theme}
                viewPeople={realAdmin ? viewPeople : null} viewingId={me.viewingAs ? me.person.id : null} />
            </aside>
            <main className="main"><div className="topbar"><TopSearch /><FeedbackLink /><HelpToggle /></div><div className="page"><ProjectPeopleProvider value={projectPeople} mayAddTo={mayAddTo}>{children}</ProjectPeopleProvider></div></main>
          </div>
          </ViewerProvider>
          </PhotoProvider>
          </JevProvider>
          </ReadOnlyProvider>
        ) : (
          <main className="page-solo">{children}</main>
        )}
        </HelpProvider>
      </body>
    </html>
  );
}
