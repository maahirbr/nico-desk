import { SkHead, SkPage, SkStats, SkTable } from '@/components/skeletons';

export default function Loading() {
  return (<SkPage><SkHead /><SkStats n={5} /><SkTable /></SkPage>);
}
