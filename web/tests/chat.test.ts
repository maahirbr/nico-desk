import { describe, expect, it } from 'vitest';
import { parseChat } from '../lib/chat';

// The chat parser. No network, no database. Names and numbers are synthetic.
const IOS = [
  '‎[13/10/26, 9:41:02 AM] Meera Iyer: ‎Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
  '[13/10/26, 9:41:30 AM] Kabir Sethi: Can you send the Autumn banner by Friday?',
  '[13/10/26, 9:42:10 AM] Meera Iyer: Yes.',
  'I will do it after lunch.',
  '',
  'Also the copy is pending.',
  '[13/10/26, 9:43:00 AM] Kabir Sethi: ‎image omitted',
  "[13/10/26, 1:05:00 PM] Ananya Rao joined using this group's invite link",
  '[13/10/26, 11:59:59 PM] Ananya Rao: done',
  '[14/10/26, 12:05:00 AM] Ananya Rao: midnight one',
].join('\n');

const ANDROID = [
  '13/10/26, 9:41 am - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
  '13/10/26, 9:42 am - Meera Iyer: Shoot plan is blocked on the venue',
  '13/10/26, 9:43 am - Kabir Sethi: <Media omitted>',
  '13/10/26, 21:15 - Kabir Sethi: Venue reply tomorrow',
  '13/10/26, 21:16 - Ishaan Bhatt left',
  '13/10/26, 21:17 - Ishaan Bhatt: ok',
].join('\n');

describe('chat parser', () => {
  it('reads the iOS export: sender, ISO date, 24h time, continuation lines', () => {
    const r = parseChat(IOS);
    expect(r.format).toBe('ios');
    expect(r.messages.map((m) => m.sender)).toEqual(['Kabir Sethi', 'Meera Iyer', 'Ananya Rao', 'Ananya Rao']);
    expect(r.messages[0]).toEqual({ index: 0, sender: 'Kabir Sethi', date: '2026-10-13', time: '09:41', text: 'Can you send the Autumn banner by Friday?' });
    expect(r.messages[1].text).toBe('Yes.\nI will do it after lunch.\n\nAlso the copy is pending.');
    expect(r.messages.map((m) => m.time)).toEqual(['09:41', '09:42', '23:59', '00:05']);
    expect(r.messages.map((m) => m.index)).toEqual([0, 1, 2, 3]);
  });

  it('drops the encryption notice, media placeholders and joined lines, and counts them', () => {
    const r = parseChat(IOS);
    expect(r.messages.some((m) => /encrypted|omitted|joined/.test(m.text))).toBe(false);
    expect(r.dropped).toBe(3);
  });

  it('reads the Android export, 12h and 24h, and drops system lines', () => {
    const r = parseChat(ANDROID);
    expect(r.format).toBe('android');
    expect(r.messages.map((m) => `${m.sender}|${m.time}|${m.text}`)).toEqual([
      'Meera Iyer|09:42|Shoot plan is blocked on the venue',
      'Kabir Sethi|21:15|Venue reply tomorrow',
      'Ishaan Bhatt|21:17|ok',
    ]);
    expect(r.dropped).toBe(3);
  });

  it('reads the iOS web form with the time first and a narrow no-break space before PM', () => {
    const r = parseChat('[9:41 pm, 13/10/2026] Priya Menon: hello');
    expect(r.messages[0]).toMatchObject({ sender: 'Priya Menon', date: '2026-10-13', time: '21:41', text: 'hello' });
  });

  it('reads day first by default and month first only when the chat proves it', () => {
    expect(parseChat('[03/04/26, 9:00 AM] A: x').messages[0].date).toBe('2026-04-03');
    expect(parseChat('[03/04/26, 9:00 AM] A: x\n[03/25/26, 9:00 AM] A: y').messages.map((m) => m.date)).toEqual(['2026-03-04', '2026-03-25']);
    expect(parseChat('[13/04/26, 9:00 AM] A: x\n[03/25/26, 9:00 AM] A: y').messages[0].date).toBe('2026-04-13');
  });

  it('gives null for an impossible date or time instead of guessing', () => {
    const m = parseChat('[31/02/26, 25:61 AM] A: x').messages[0];
    expect(m.date).toBeNull();
    expect(m.time).toBeNull();
  });

  it('reads plain lines with no header as one message each', () => {
    const r = parseChat('Banner is late\n\n  Shoot venue confirmed  \r\nLoyalty pilot: send the list\n');
    expect(r.format).toBe('plain');
    expect(r.messages.map((m) => m.text)).toEqual(['Banner is late', 'Shoot venue confirmed', 'Loyalty pilot: send the list']);
    expect(r.messages.every((m) => m.sender === null && m.date === null && m.time === null)).toBe(true);
  });

  it('keeps plain lines that come before the first header', () => {
    const r = parseChat('Forwarded: banner late\n[13/10/26, 9:41 AM] Meera Iyer: ok');
    expect(r.messages.map((m) => m.text)).toEqual(['Forwarded: banner late', 'ok']);
  });

  it('does not treat a message that mentions joining or leaving as a system line', () => {
    const r = parseChat('13/10/26, 9:41 am - Meera Iyer: I left the file on the shared drive\n13/10/26, 9:42 am - Kabir Sethi: Ananya was added to the shoot team');
    expect(r.messages).toHaveLength(2);
  });

  it('drops a group event even when it has a colon in it', () => {
    const r = parseChat('13/10/26, 9:41 am - Meera Iyer changed the group description to: planning\n13/10/26, 9:42 am - Kabir Sethi: hi');
    expect(r.messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('keeps a sender that is a phone number and strips the unsaved-contact tilde', () => {
    const r = parseChat('13/10/26, 9:41 am - ~ Rohan: hi\n13/10/26, 9:42 am - +91 90000 00009: hello');
    expect(r.messages.map((m) => m.sender)).toEqual(['Rohan', '+91 90000 00009']);
  });

  it('returns nothing for empty input', () => {
    expect(parseChat('').messages).toEqual([]);
    expect(parseChat('  \n \n').messages).toEqual([]);
  });

  it('keeps a text that has a colon and a time inside it', () => {
    const r = parseChat('13/10/26, 9:41 am - Meera Iyer: call at 9:30: bring the deck');
    expect(r.messages[0]).toMatchObject({ sender: 'Meera Iyer', text: 'call at 9:30: bring the deck' });
  });
});
