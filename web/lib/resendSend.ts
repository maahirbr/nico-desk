import { ApiError } from './errors';
import { cleanHtml } from './gmailSend';

// Send a reminder through Resend when the lead has not connected Gmail (the repo owner's yes, 18 Nov). Only the lead's
// press of Send calls this, as with Gmail. The mail goes from one company sender on Resend's verified domain, named
// "<lead> via nico-desk", with Reply-To set to the lead, so replies reach the lead and not the app.
//
// Off unless NICO_RESEND_SEND=1, RESEND_API_KEY and NICO_RESEND_FROM (a plain address on the verified domain) are set.
// The key lives only in .env.local and in Vercel env vars, never in git and never in a response.
// Endpoint: POST https://api.resend.com/emails   https://resend.com/docs/api-reference/emails/send-email

const SEND_URL = 'https://api.resend.com/emails';
const key = () => (process.env.RESEND_API_KEY ?? '').trim();
const ADDR = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
export const resendFrom = () => (process.env.NICO_RESEND_FROM ?? '').trim().toLowerCase();

export function resendSendEnabled(): boolean {
  return process.env.NICO_RESEND_SEND === '1' && !!key() && ADDR.test(resendFrom());
}

// The From line, in Resend's "Name <address>" form: the lead's name with "via nico-desk", then the company sender.
// The name keeps only letters, digits, spaces, dots, apostrophes and hyphens, so it cannot add or change an address.
export function resendFromLine(name: string): string {
  const n = name.replace(/[^\p{L}\p{M}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return `${n ? `${n} via nico-desk` : 'nico-desk'} <${resendFrom()}>`;
}

export type ResendOut = { fromName: string; replyTo: string; to: string[]; cc: string[]; bcc: string[]; subject: string; html: string; text: string };

export function resendPayload(m: ResendOut) {
  return {
    from: resendFromLine(m.fromName), reply_to: [m.replyTo], to: m.to,
    ...(m.cc.length ? { cc: m.cc } : {}), ...(m.bcc.length ? { bcc: m.bcc } : {}),
    subject: m.subject.replace(/[\r\n]+/g, ' ').trim(), html: `<div>${cleanHtml(m.html)}</div>`, text: m.text,
  };
}

export async function sendViaResend(m: ResendOut): Promise<{ from: string }> {
  let res: Response;
  try {
    res = await fetch(SEND_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload(m)), signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, 'source_unreachable', 'The email service did not answer. The email may not have gone. Ask the person before you try again.');
  }
  // 401 and 403: a missing or wrong key, or a sender off the verified domain. Only an admin can fix those.
  if (res.status === 401 || res.status === 403) throw new ApiError(502, 'resend_refused', 'The email service refused the app\'s key or sender. Tell an admin.');
  if (res.status === 422 || res.status === 400) throw new ApiError(400, 'resend_rejected', 'The email service would not send this. Check the addresses.');
  if (res.status === 429) throw new ApiError(429, 'rate_limited', 'The email service is busy. Wait a minute and try again.');
  if (!res.ok) throw new ApiError(502, 'source_error', `The email service returned an error (${res.status}).`);
  return { from: resendFrom() };
}
