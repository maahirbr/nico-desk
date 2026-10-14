import { z } from 'zod';
import { readBody, route, sameTeam, zDate } from '@/lib/http';
import { getProject, planOp, planState } from '@/lib/plan';

const id = z.string().min(1).max(80);
const txt = (max: number) => z.string().max(max);
const date = zDate.nullable();

const Op = z.discriminatedUnion('op', [
  z.object({ op: z.literal('status'), lineId: id, status: z.enum(['Not started', 'In progress', 'Blocked', 'Done']), reason: txt(280).optional() }),
  z.object({ op: z.literal('tickCheckpoint'), lineId: id, cpId: id, done: z.boolean() }),
  z.object({
    op: z.literal('editLine'), lineId: id, what: txt(200), doneDef: txt(600), note: txt(160), ownerId: id.nullable(), ownerWith: txt(200),
    partner: txt(80), partnerRole: txt(400), mode: z.enum(['coaching', 'hands-on']), dueOn: date, byLabel: txt(80),
    checkpoints: z.array(z.object({ id: id.optional(), label: txt(120), dueOn: date })).max(20), dateReason: txt(280).optional(),
  }),
  z.object({ op: z.literal('removeLine'), lineId: id, reason: txt(140) }),
  z.object({ op: z.literal('restoreLine'), lineId: id }),
  z.object({
    op: z.literal('addLine'), pillar: txt(40), what: txt(200), doneDef: txt(600), ownerId: id.nullable(), partner: txt(80), partnerRole: txt(400), dueOn: date,
  }),
  z.object({ op: z.literal('tickAsk'), askId: id, done: z.boolean() }),
  z.object({ op: z.literal('tickAction'), actionId: id, done: z.boolean() }),
  z.object({ op: z.literal('removeAction'), actionId: id }),
  z.object({ op: z.literal('importMinutes'), title: txt(120), date: zDate, text: z.string().min(1).max(60_000),
    source: z.object({ provider: z.enum(['granola', 'fireflies']), id: id, link: z.string().url().max(500).nullable().optional() }).optional() }),
  z.object({
    op: z.literal('acceptProposal'), proposalId: id, lineId: id.nullable(), task: txt(400).optional(), ownerName: txt(80).optional(),
    ownerWith: txt(200).optional(), dueOn: date.optional(), ownerId: id.nullable().optional(), workstream: txt(60).nullable().optional(),
  }),
  z.object({ op: z.literal('rejectProposal'), proposalId: id }),
  z.object({ op: z.literal('acceptSure'), batch: id }),
  z.object({ op: z.literal('dismissBatch'), batch: id }),
]);

export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  sameTeam(me, (await getProject(db, params.id)).teamId);
  return planState(db, params.id);
});

// Any active member of the team can update the plan; every change lands in the plan's update log.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Op);
  sameTeam(me, (await getProject(db, params.id)).teamId);
  return planOp(db, me.person.id, params.id, b);
});
