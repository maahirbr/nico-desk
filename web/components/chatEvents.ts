// One small signal between the chat screens and the nav: "the unread count may have changed, ask again".
// The room view sends it after it marks a room read, and after a message goes out. The nav and the room list listen.
export const CHAT_CHANGED = 'nd:chat';

export function chatChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHAT_CHANGED));
}

// True when this browser tab is on screen. Chat asks the server only then, so a hidden tab costs nothing.
export const tabVisible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';
