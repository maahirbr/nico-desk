import { describe, expect, it } from 'vitest';
import { nextStepsOf, plainParse, tableSteps } from '../lib/planUtil';

// A table pasted as minutes (20 Nov, the PM's ask): from a doc, a cell per line; from a sheet, tab-separated.
const DOC = "\u00a74 \u00b7 Action Steps from Previous Meetings\n\n#\nAction Steps\nOwner\nCommitted date\nStatus\n1\nBuild daily subcategory stock artifact for Diwali (next 18 days)\nKabir\n\n\n Not started\n2\nPriya to present non-transactional communication plan (27th October)\nPriya\n27 Oct 2026\n Not started\n3\nConnect ads tracker sales data to Nicobar AI auto-populate\nAnanya\n\n\n Not started\n4\nDecide outreach approach for 127 unconverted partner leads\nRohan\n\n\n Not started\n5\nAdd IT volunteers (Sam etc.) to store visit roster in onboarding plan\n\n\n\n\n Not started\n6\nRun Tuesday session with area managers and store managers on customer greeting\n\n\n27 Oct 2026\n Not started\n";

describe('a pasted table of action steps', () => {
  it('reads a doc table row by row: task, owner, date, and nothing from the headings or statuses', () => {
    const steps = plainParse(tableSteps(DOC) ?? nextStepsOf(DOC), '2026-10-20');
    expect(steps.map((s) => [s.owner, s.task, s.due])).toEqual([
      ['Kabir', 'Build daily subcategory stock artifact for Diwali', '2026-11-07'],
      ['Priya', 'Present non-transactional communication plan', '2026-10-27'],
      ['Ananya', 'Connect ads tracker sales data to Nicobar AI auto-populate', ''],
      ['Rohan', 'Decide outreach approach for 127 unconverted partner leads', ''],
      ['', 'Add IT volunteers (Sam etc.) to store visit roster in onboarding plan', ''],
      ['', 'Run Tuesday session with area managers and store managers on customer greeting', '2026-10-27'],
    ]);
  });
  it('reads a sheet table, and leaves out a row that is done', () => {
    const tsv = 'Task\tOwner\tDue date\tStatus\nSend the deck\tKabir\t27 Oct 2026\tNot started\nBook the studio\tPriya\t\tDone\nCall the printer\tAnanya\tin 3 days\tIn progress';
    expect(plainParse(tableSteps(tsv)!, '2026-10-20').map((s) => [s.owner, s.task, s.due])).toEqual([
      ['Kabir', 'Send the deck', '2026-10-27'], ['Ananya', 'Call the printer', '2026-10-23'],
    ]);
  });
  it('is not a table when there is no header row', () => {
    expect(tableSteps('- Kabir to send the deck by Monday')).toBeNull();
  });
});
