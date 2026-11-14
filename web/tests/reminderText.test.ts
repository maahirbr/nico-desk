import { describe, expect, it } from 'vitest';
import { bodyFor, bodyHtmlFor, type RemindItem } from '../lib/reminderText';

// The reminder email (15 Nov): grouped by project, the latest first, bold headings and names in the HTML version.
const item = (title: string, where: string, dueOn: string, days: number): RemindItem => ({ key: title, title, where, dueOn, days, kind: 'task', flag: null });
const items = [
  item('Release the policy', 'AI OKR', '2026-10-21', -25),
  item('Shortlist 4 colleges', 'Hiring', '2026-10-29', -17),
  item('Publish the ladder', 'AI OKR', '2026-10-15', -31),
  item('Send the deck', 'Hiring', '2026-11-16', 1),
];

describe('the reminder email', () => {
  it('groups by project, latest first, with the project said once', () => {
    const text = bodyFor('Sam Rao', items, 'https://example.test/me', 'Priya');
    expect(text).toBe([
      'Hi Sam,', '', 'These 4 tasks need an update, 3 past their date:', '',
      'AI OKR', '• Publish the ladder, due 15 Oct (31 days late)', '• Release the policy, due 21 Oct (25 days late)', '',
      'Hiring', '• Shortlist 4 colleges, due 29 Oct (17 days late)', '• Send the deck, due tomorrow, 16 Nov', '',
      'Could you update these today? Mark them done, or push the date with a line on why: https://example.test/me', '', 'Best,', 'Priya',
    ].join('\n'));
  });
  it('puts only the project heading in bold for Send, and escapes text', () => {
    const html = bodyHtmlFor('Sam', [item('Fix <b>', 'R&D', '2026-10-15', -2)], 'https://example.test/me', 'Priya');
    expect(html).toContain('<b>R&amp;D</b><ul><li>Fix &lt;b&gt;, <i>due 15 Oct (2 days late)</i></li></ul>');
    expect(html).toContain('Best,<br>Priya');
  });
});
