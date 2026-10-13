import { jevOn } from '@/lib/jev';
import { searchByMeaning } from '@/lib/jevSearch';
import { rateLimit, route } from '@/lib/http';
import { search } from '@/lib/search';

// Plain search is local and instant. With ?meaning=1 and Jev on, the same query is re-ranked by meaning. The header
// x-nico-jev tells the page whether a second, by-meaning call is worth making: off | on | ranked.
export const GET = route(async ({ req, me, db }) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').slice(0, 120);
  const on = jevOn();
  if (on && url.searchParams.get('meaning') === '1') {
    let allowed = true;
    try { rateLimit(`jev-q:${me.realPerson.id}`, 20); } catch { allowed = false; }
    if (allowed) {
      const { hits, ranked } = await searchByMeaning(db, me.team.id, q);
      return Response.json(hits, { headers: { 'x-nico-jev': ranked ? 'ranked' : 'on' } });
    }
  }
  return Response.json(await search(db, me.team.id, q), { headers: { 'x-nico-jev': on ? 'on' : 'off' } });
});
