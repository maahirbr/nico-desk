import { SkGroups, SkHead, SkPage } from '@/components/skeletons';

export default function Loading() {
  return (<SkPage><SkHead /><SkGroups groups={3} rows={3} /></SkPage>);
}
