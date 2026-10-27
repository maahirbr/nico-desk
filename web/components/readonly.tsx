'use client';

import { createContext, useContext } from 'react';

// True while an admin is viewing the site as someone else (lib/auth.ts, "View as"). Write controls hide or
// disable. The server refuses every write in that state anyway (lib/http.ts), so this only keeps the screen honest.
const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) => (
  <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>
);

export const useReadOnly = () => useContext(ReadOnlyContext);
