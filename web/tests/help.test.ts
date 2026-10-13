import { describe, expect, it } from 'vitest';
import { HELP, HELP_TERMS, helpOf, helpText } from '../components/help';

describe('help text', () => {
  it('covers every term: the list below and HELP match exactly', () => {
    const COVERED = [
      'status_todo', 'status_doing', 'status_blocked', 'status_done', 'status_dropped',
      'late', 'at_risk', 'ahead', 'on_time', 'flagged_early', 'missed', 'on_time_record', 'slipped_silently',
      'ledger_kept', 'ledger_closed_ok', 'ledger_closed_late', 'ledger_pastdue',
      'moved_date', 'moved_in_time', 'blocked_on', 'project_owner', 'project_lead', 'sounds', 'view_as',
      'remind_gmail', 'remind_mail', 'remind_copy',
      'comment_box', 'comment_mention', 'comment_urgent', 'connects_to',
      // coverage pass of 13 Oct
      'group_today', 'group_this_week', 'group_later', 'overdue', 'waiting_on_you', 'updates_for_you', 'mark_seen', 'your_projects', 'done_this_week',
      'team_by_person', 'team_by_status', 'coming_up',
      'project_on_track', 'project_at_risk', 'project_off_track', 'project_archived', 'project_internal', 'project_partner', 'project_progress',
      'tile_open', 'pushed', 'priority', 'unblock', 'move_date', 'reassign',
      'plan_status', 'plan_pending', 'plan_hands_on', 'plan_coaching', 'plan_checkpoints', 'plan_asks', 'plan_ongoing', 'plan_parked',
      'proposals', 'proposal_sure', 'proposal_unsure',
      'done_ahead', 'done_on_time', 'done_late', 'open_past_due', 'date_moves', 'recent_updates',
      'delivery_habits', 'needs_attention', 'moved_late',
      'search_filters', 'search_commands', 'search_recent', 'meeting_rhythm', 'meeting_agenda', 'meeting_held',
      'waiting_done', 'plan_done_looks_like', 'plan_actions', 'plan_by_subproject', 'plan_by_date', 'proposal_accept_sure',
      'paste_review', 'paste_masked',
      'conn_from_env',
    ];
    expect([...COVERED].sort()).toEqual([...HELP_TERMS].sort());
    expect([...HELP_TERMS].sort()).toEqual(Object.keys(HELP).sort());
  });

  it('gives each term non-empty text through helpText', () => {
    for (const term of HELP_TERMS) expect(helpText(term).trim().length, term).toBeGreaterThan(0);
  });

  it('uses plain words: short sentences, no em dashes, no semicolons', () => {
    for (const [term, text] of Object.entries(HELP)) {
      expect(text, term).not.toMatch(/[—–;]/);
      const sentences = text.split(/(?<=[.!?])\s+/);
      for (const s of sentences) expect(s.split(/\s+/).length, `${term}: ${s}`).toBeLessThanOrEqual(25);
    }
  });
});

describe('helpOf', () => {
  it('is on only for the cookie value "1"', () => {
    expect(helpOf('1')).toBe(true);
    expect(helpOf('0')).toBe(false);
    expect(helpOf('')).toBe(false);
    expect(helpOf(undefined)).toBe(false);
    expect(helpOf(null)).toBe(false);
    expect(helpOf('true')).toBe(false);
  });
});
