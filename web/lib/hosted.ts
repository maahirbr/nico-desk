// Hosted mode is on when the Supabase URL is set. NEXT_PUBLIC_ values are inlined at build, so this
// also works in client components. Local mode (PGlite, the dev "act as" cookie) is the default.
export function isHosted(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

// Where the "act as" picker lives: /dev/act-as is 404 in production, /act-as needs a signed-in user.
export function actAsPath(): string {
  return isHosted() ? "/act-as" : "/dev/act-as";
}
