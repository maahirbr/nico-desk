'use client';

import { useEffect } from 'react';
import { markHydrated } from './motion';

// Tells the motion helpers the first page has hydrated, so a number or list that appears later may animate.
export function MotionBoot() {
  useEffect(() => { markHydrated(); }, []);
  return null;
}
