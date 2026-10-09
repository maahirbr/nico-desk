"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const ITEMS = [
  { href: "/week", label: "My week" },
  { href: "/asks", label: "Asks" },
  { href: "/team", label: "Team" },
  { href: "/team/record", label: "Record", lead: true },
];

export function Nav({ canRecord }: { canRecord: boolean }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => canRecord || !i.lead);
  // The longest matching href wins, so /team/record lights Record and not Team.
  const on = items
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label="Main" className={styles.nav}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i === on ? "page" : undefined} className={styles.item}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
