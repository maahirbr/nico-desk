// The text an admin copies and pastes to a new person. The app sends nothing: it only builds the words.
// `origin` is the address the admin has open (window.location.origin), so it is right on every deploy.
export function inviteText(origin: string, email: string): string {
  return `You have been added to NicoDesk. Open ${origin} and sign in with your Google work account. Use the email you were added with: ${email.trim().toLowerCase()}`;
}

// The same invite as an email the admin sends from their own Gmail (4 Nov). The app opens it filled in; nothing is sent
// until the admin presses Send there.
export function inviteEmail(origin: string, email: string, name: string, from: string): { subject: string; body: string } {
  const first = (s: string) => s.trim().split(' ')[0] || s;
  return {
    subject: 'Join NicoDesk',
    body: [`Hi ${first(name)},`, '', 'You have been added to NicoDesk, where the team keeps track of tasks, projects and who is doing what.', '',
      'To get started:', `1. Open ${origin}`, `2. Sign in with Google, using this email: ${email.trim().toLowerCase()}`, '',
      'It takes a minute. The quick guide inside shows you around.', '', 'See you there!', first(from)].join('\n'),
  };
}
