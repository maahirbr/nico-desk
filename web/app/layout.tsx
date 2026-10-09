import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { KeyboardRule } from "@/components/shell/KeyboardRule";
import page from "@/components/shell/Page.module.css";
import { Shell } from "@/components/shell/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "nico-desk",
  description: "One place where a team runs its week.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <KeyboardRule />
        <Shell />
        <main className={page.page}>{children}</main>
      </body>
    </html>
  );
}
