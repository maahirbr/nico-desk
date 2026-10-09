import Link from "next/link";
import { CommitField } from "./CommitField";
import { InitialsMark } from "./InitialsMark";
import { actAsPath, isHosted } from "@/lib/hosted";
import { Nav } from "./Nav";
import styles from "./TopBar.module.css";

export type Viewer = { name: string; canRecord: boolean };

// The viewer's mark and first name. It opens the "act as" picker: /dev/act-as locally, /act-as when hosted.
function You({ name }: { name: string }) {
  const body = (
    <>
      <InitialsMark name={name} you />
      <span>{name.split(" ")[0]}</span>
    </>
  );
  return process.env.NODE_ENV === "production" && !isHosted() ? (
    <span className={styles.you}>{body}</span>
  ) : (
    <Link href={actAsPath()} className={styles.you} title="Change who you are acting as">
      {body}
    </Link>
  );
}

// viewer is undefined while the cookie is read, null when nobody is chosen.
export function TopBar({ viewer }: { viewer?: Viewer | null }) {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.mark}>
        nico-desk
      </Link>
      {viewer === undefined ? null : viewer ? (
        <>
          <div className={styles.nav}>
            <Nav canRecord={viewer.canRecord} />
          </div>
          <CommitField />
          <You name={viewer.name} />
        </>
      ) : (
        <Link href={actAsPath()} className={styles.who}>
          Choose who you are
        </Link>
      )}
    </header>
  );
}
