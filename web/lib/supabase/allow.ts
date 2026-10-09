// The pilot list. ALLOWED_EMAILS is a comma separated list of addresses, ALLOWED_EMAIL_DOMAINS a
// comma separated list of domains. With neither set, nobody is allowed.
const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e.includes("@")) return false;
  if (list(process.env.ALLOWED_EMAILS).includes(e)) return true;
  const domain = e.slice(e.lastIndexOf("@") + 1);
  return list(process.env.ALLOWED_EMAIL_DOMAINS).includes(domain);
}
