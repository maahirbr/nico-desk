import { SkCards, SkHead, SkPage, SkStats } from '@/components/skeletons';

export default function Loading() {
  return (<SkPage><SkHead /><SkStats n={4} /><SkCards n={3} /></SkPage>);
}
