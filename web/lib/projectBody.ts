import { z } from 'zod';
import { zDate } from './http';

// The body for starting or editing a project (lib/plan.ts createProject, updateProject).
export const ProjectBody = z.object({
  name: z.string().max(80), kind: z.enum(['tasks', 'plan']), ownerId: z.string().min(1).max(80), goal: z.string().max(600),
  eyebrow: z.string().max(120).optional(), phase: z.string().max(60).optional(), launchOn: zDate.nullable().optional(),
  targetLabel: z.string().max(40).optional(), workstreams: z.array(z.string().max(60)).max(20),
  members: z.array(z.object({ personId: z.string().min(1).max(80), role: z.string().max(60) })).max(40),
  partnerName: z.string().max(80).optional(), partnerPeople: z.array(z.string().max(60)).max(20).optional(),
}).strict();

