import styles from "./Page.module.css";

export function PageTitle({ children }: { children: string }) {
  return <h1 className={styles.title}>{children}</h1>;
}
