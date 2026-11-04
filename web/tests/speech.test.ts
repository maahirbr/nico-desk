import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { joinSaid } from '../components/speech';

const src = (f: string) => readFileSync(new URL(`../components/${f}`, import.meta.url), 'utf8');

describe('what the mic adds to a box', () => {
  it('fills an empty box', () => {
    expect(joinSaid('', 'send the samples', 280)).toBe('send the samples');
  });

  it('keeps what was there and adds one space', () => {
    expect(joinSaid('Waiting on the mill.', 'They said Friday', 280)).toBe('Waiting on the mill. They said Friday');
    expect(joinSaid('Waiting on the mill. ', 'They said Friday', 280)).toBe('Waiting on the mill. They said Friday');
    expect(joinSaid('First line\n', 'second line', 280)).toBe('First line\nsecond line');
  });

  it('stays inside the limit of the box', () => {
    expect(joinSaid('12345', 'abcdefgh', 10)).toBe('12345 abcd');
    expect(joinSaid('1234567890', 'abc', 10)).toBe('1234567890');
  });
});

describe('where the mic is', () => {
  it('is on updates and details', () => {
    const ui = src('task-ui.tsx');
    expect(ui).toContain('<SayBox value={reply}');
    expect(ui).toContain('<SayBox value={edit.description}');
    expect(ui).toContain('<SayBox value={d.description}');
    expect(src('TaskBoard.tsx')).toContain('<SayBox value={f.description}');
    expect(src('client.tsx')).toContain('<ReasonForm say title="Add an update"');
  });

  it('has one speech service, which Quick Add shares', () => {
    const quick = src('QuickAdd.tsx');
    expect(quick).toContain("from './speech'");
    expect(quick).not.toContain('SpeechRecognition');
  });

  it('never posts or saves by itself', () => {
    const speech = src('speech.tsx');
    expect(speech).not.toMatch(/fetch\(|api\(/);
  });
});
