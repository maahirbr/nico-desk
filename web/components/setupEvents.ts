import { viewKey } from '@/lib/remember';

// How the setup check-list (components/SetupList.tsx) reaches UI that already exists, without new props: it asks by
// window event, the way "Write the minutes" does with IMPORT_EVENT (components/MeetingSection.tsx).
export const OPEN_SETTINGS_EVENT = 'nd:open-project-settings'; // ProjectHeader opens the Settings modal
export const OPEN_ADD_EVENT = 'nd:open-add-work'; // the board opens its add task or add line form
export const SHOW_SETUP_EVENT = 'nd:show-setup-list'; // Settings brings a hidden list back

// Hidden per person and per project, in this browser (localStorage, always in try/catch).
export const setupKey = (meId: string, projectId: string) => viewKey(meId, `setup:${projectId}`);
