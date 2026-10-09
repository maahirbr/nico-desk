import { SkCards, SkHead, SkPage } from '@/components/skeletons';

export default function Loading() {
  return (<SkPage><SkHead /><SkCards n={6} /></SkPage>);
}
