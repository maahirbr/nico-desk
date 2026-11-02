import { z } from 'zod';

// The roster fields, with the words the form shows when one is wrong. The add, bulk add and edit routes all use them.
const text = (label: string) => {
  const say = `${label} must be 2 to 80 characters.`;
  return z.string(say).trim().min(2, say).max(80, say);
};

export const personFields = z.object({
  displayName: text('Name'),
  role: text('Job title'),
  department: text('Department'),
  email: z.email('Enter a valid email address.'),
});
