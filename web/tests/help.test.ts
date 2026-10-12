import { describe, expect, it } from 'vitest';
import { HELP, HELP_TERMS, helpOf, helpText } from '../components/help';

// Every term the plan says help mode must explain.
const COVERED = [
  'status_todo', 'status_doing', 'status_blocked', 'status_done', 'status_dropped',
  'late', 'at_risk', 'flagged_early', 'missed', 'on_time_record',
  'ledger_kept', 'ledger_closed_ok', 'ledger_closed_late', 'ledger_pastdue',
  'moved_date', 'blocked_on', 'project_lead', 'view_as',
  'remind_gmail', 'remind_mail', 'remind_copy',
] as const;

describe('help text', () => {
  it('covers every listed term', () => {
    for (const term of COVERED) expect(HELP_TERMS, term).toContain(term);
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
