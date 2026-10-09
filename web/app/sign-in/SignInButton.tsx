"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import styles from "./sign-in.module.css";

export function SignInButton() {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setBusy(false);
  }

  return (
    <button type="button" className={styles.button} onClick={go} disabled={busy}>
      Continue with Google
    </button>
  );
}
