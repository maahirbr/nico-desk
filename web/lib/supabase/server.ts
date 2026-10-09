import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail } from "./allow";

// A Supabase client bound to the request cookies. Used in server components, actions and route handlers.
export async function createClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        // Server components cannot set cookies. The proxy has already refreshed the session, so skip.
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {}
      },
    },
  });
}

// The signed-in user's email, only when the session verifies and the address is on the pilot list.
// The list is checked here too, because the publishable key is public and anyone can get a Supabase session.
export async function allowedSessionEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  return isAllowedEmail(email) ? email : null;
}
