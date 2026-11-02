// The text an admin copies and pastes to a new person. The app sends nothing: it only builds the words.
// `origin` is the address the admin has open (window.location.origin), so it is right on every deploy.
export function inviteText(origin: string, email: string): string {
  return `You have been added to NicoDesk. Open ${origin} and sign in with your Google work account. Use the email you were added with: ${email.trim().toLowerCase()}`;
}
