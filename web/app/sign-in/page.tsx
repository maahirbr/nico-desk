import { Suspense } from "react";
import { SignInButton } from "./SignInButton";
import styles from "./sign-in.module.css";

// searchParams is a request-time value, so the line that reads it sits in Suspense.
async function Denied({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return denied ? <p className={styles.denied}>This account is not on the pilot list.</p> : null;
}

export default function SignInPage(props: { searchParams: Promise<{ denied?: string }> }) {
  return (
    <section className={styles.card}>
      <h1 className={styles.title}>Sign in</h1>
      <Suspense fallback={null}>
        <Denied searchParams={props.searchParams} />
      </Suspense>
      <SignInButton />
    </section>
  );
}
