import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FindServer } from "@/components/find/FindServer";
import { GroundControls } from "@/components/GroundControls";
import { NavThreads } from "@/components/NavThreads";
import { WhoLine } from "@/components/WhoLine";
import "./globals.css";

export const metadata: Metadata = {
  title: "nico-desk",
  description: "One place where a team runs its week.",
};

// Runs before paint: sets night and static from what the person chose last time.
const BOOT = `try{var d=document.documentElement;if(localStorage.getItem('nd-ground')==='night')d.classList.add('dark');if(localStorage.getItem('nd-static')==='1')d.dataset.motion='static';}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this is the root layout, so it covers every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <div className="shell mx-auto w-full max-w-[1080px] px-4 py-6">
          <div className="alt-sheet">
            <header className="hd px-[14px] pt-4">
              <Link href="/" className="hd-logo caps font-medium">
                nico-desk
              </Link>
              <div className="hd-right">
                <span className="hd-who">
                  <Suspense fallback={null}>
                    <WhoLine />
                  </Suspense>
                </span>
                <FindServer />
                <GroundControls />
              </div>
            </header>
            <div id="find-slot" className="find-slot px-[14px]" aria-live="polite" />
            <div className="hd-nav px-[14px] pb-2">
              <Suspense fallback={null}>
                <NavThreads>
                  <Suspense fallback={null}>
                    <WhoLine short />
                  </Suspense>
                </NavThreads>
              </Suspense>
            </div>
            <div style={{ borderTop: "var(--rule-section)" }}>{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
