'use client';

import { createContext, useContext } from 'react';

// Whether Jev is switched on (NICO_JEV and its key, lib/jev.ts jevOn). The server decides and passes it here, so a
// client piece can hide a Jev control without importing anything of Jev. Off: the control is not drawn at all.
const JevContext = createContext(false);

export const JevProvider = ({ on, children }: { on: boolean; children: React.ReactNode }) => (
  <JevContext.Provider value={on}>{children}</JevContext.Provider>
);

export const useJev = () => useContext(JevContext);
