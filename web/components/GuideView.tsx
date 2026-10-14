'use client';

import '../app/guide.css';
import { HELP, type HelpTerm } from './help';
import { SHORTCUTS } from './keys';
import { PICK, STATUS, StatusIcon, type StatusKey } from './task-ui';

// The Guide page (/guide): a short read for a team that is new to Nico Desk. It has no state. It is a client module
// only because PICK and STATUS live in task-ui.tsx, which is one. The status words come from help.ts (the same text help mode shows) and the keys from keys.ts, so neither can
// drift from the app. Everything else is written here, in plain words.

// The section headings, in order. The test pins these and the page renders them as its h2 elements.
export const GUIDE_SECTIONS = [
  { id: 'purpose', title: 'What Nico Desk is for' },
  { id: 'week', title: 'A week in Nico Desk' },
  { id: 'statuses', title: 'The five statuses' },
  { id: 'rule', title: 'The one rule' },
  { id: 'blocked', title: 'When you are blocked' },
  { id: 'leads', title: 'For leads and admins' },
  { id: 'help', title: 'Help mode and shortcuts' },
  { id: 'phone', title: 'On your phone' },
  { id: 'feedback', title: 'Tell us what is not working' },
] as const;

const title = (id: (typeof GUIDE_SECTIONS)[number]['id']) => GUIDE_SECTIONS.find((s) => s.id === id)!.title;

// "Blocked. Work has stopped. The reason is on the task." gives the word and what follows it.
export function helpRest(term: HelpTerm): string {
  const text = HELP[term];
  const i = text.indexOf('. ');
  return i < 0 ? '' : text.slice(i + 2);
}

const FLAGS: { term: HelpTerm; word: string }[] = [
  { term: 'late', word: 'Late' },
  { term: 'at_risk', word: 'At risk' },
];

const WEEK: [string, string][] = [
  ['Monday', 'Open Home to see what is on your side. Open Team to see what everyone has this week.'],
  ['Through the week', 'Tick tasks off as you finish them. Change the status when the work changes.'],
  ['When a date will slip', 'Move it before it passes. Write the reason.'],
  ['Friday', 'Open Done this week on Home to see what closed.'],
];

export function GuideView() {
  return (
    <article className="guide calm narrow">
      <header className="page-head">
        <div>
          <h1>How to use Nico Desk</h1>
          <p className="summary">Two minutes. Read it once, then use it in your week.</p>
        </div>
      </header>

      <section id="purpose" aria-labelledby="g-purpose">
        <h2 id="g-purpose">{title('purpose')}</h2>
        <p>Nico Desk is one place to see who owes what, and by when. Every task has one owner and a date.</p>
        <p>When everyone can see the same list, no one has to chase anyone for an update.</p>
      </section>

      <section id="week" aria-labelledby="g-week">
        <h2 id="g-week">{title('week')}</h2>
        <ol className="guide-week">
          {WEEK.map(([when, what]) => (<li key={when}><b>{when}</b><span>{what}</span></li>))}
        </ol>
      </section>

      <section id="statuses" aria-labelledby="g-statuses">
        <h2 id="g-statuses">{title('statuses')}</h2>
        <p>You pick one of five statuses for every task.</p>
        <dl className="guide-defs">
          {PICK.map((s: StatusKey) => (
            <div key={s}>
              <dt><span className={`st st-status tone-${STATUS[s].tone}`}><StatusIcon s={s} />{STATUS[s].word}</span></dt>
              <dd>{helpRest(`status_${s}`)}</dd>
            </div>
          ))}
        </dl>
        <p>Late and at risk are not statuses. The app works them out from the dates, so you never pick them.</p>
        <dl className="guide-defs">
          {FLAGS.map((f) => (
            <div key={f.term}>
              <dt><b>{f.word}</b></dt>
              <dd>{helpRest(f.term)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="rule" aria-labelledby="g-rule">
        <h2 id="g-rule">{title('rule')}</h2>
        <p className="guide-rule">Move a date before it passes, and say why.</p>
        <p>A moved date with a reason is fine. The team knew in time. The first date stays on record, and the ledger shows the task as flagged early, not missed.</p>
        <p>A silent slip is different. The date passes and no one hears. That is what the ledger counts, and the goal is 0.</p>
        <DateMoveFigure />
      </section>

      <section id="blocked" aria-labelledby="g-blocked">
        <h2 id="g-blocked">{title('blocked')}</h2>
        <p>If a task cannot go on, set it to Blocked and say what it waits on.</p>
        <p>The person it waits on sees it under Waiting on you on their Home. When they clear the block, the task goes back to In progress.</p>
      </section>

      <section id="leads" aria-labelledby="g-leads">
        <h2 id="g-leads">{title('leads')}</h2>
        <p>Leads and admins see more than members do.</p>
        <ul className="guide-list">
          <li><b>Team</b> lists every open task, by person or by status.</li>
          <li><b>Ledger</b> shows how each person kept their dates, and any silent slips.</li>
          <li><b>Reminders</b> write one draft per person who has late tasks. Each opens as a draft in your own Gmail. You press Send. The app sends nothing.</li>
          <li><b>Google Meet</b> is on only when the app is set up for it. A lead connects it on Connections. It reads the notes and transcripts of meetings that lead was in. These are notes Google already made. It does not record. Recording still needs everyone&rsquo;s consent.</li>
        </ul>
      </section>

      <section id="help" aria-labelledby="g-help">
        <h2 id="g-help">{title('help')}</h2>
        <p>Not sure what a word means? Press the ? button at the top right, or press the ? key. Help mode turns on. Words with a dotted line under them now show a short note.</p>
        <p>You can dictate into any box with a dictation app such as OpenWhispr.</p>
        <p>These keys work anywhere in the app, unless you are typing in a field.</p>
        <dl className="keylist guide-keys">
          {SHORTCUTS.map(([k, what]) => (<div key={k}><dt><kbd className="kbd-key">{k}</kbd></dt><dd>{what}</dd></div>))}
        </dl>
      </section>

      <section id="phone" aria-labelledby="g-phone">
        <h2 id="g-phone">{title('phone')}</h2>
        <p>You can put Nico Desk on your home screen. It then opens like an app, with no browser bar.</p>
        <ul>
          <li>On an iPhone, open Nico Desk in Safari. Tap Share, then Add to Home Screen.</li>
          <li>On Android, open Nico Desk in Chrome. Tap the menu, then Install app.</li>
        </ul>
        <p>You still need a connection. Nico Desk does not keep your tasks on the phone.</p>
      </section>

      <section id="feedback" aria-labelledby="g-feedback">
        <h2 id="g-feedback">{title('feedback')}</h2>
        <p>Tell the pilot lead what is confusing, missing or wrong. A short note is enough. This team&rsquo;s weeks shape what Nico Desk becomes.</p>
        <p>Open Feedback in the sidebar, under More, and write your note. The admins read it in Nico Desk. It is not sent by email.</p>
      </section>
    </article>
  );
}

// Two timelines, drawn small. Both start with the same first date. In the first, the owner moves it with a reason
// before it passes. In the second, today runs past the date and no one has said anything.
function DateMoveFigure() {
  return (
    <figure className="guide-fig">
      <svg viewBox="0 0 360 178" role="img" aria-label="Two timelines. First, a date moved before it passed, with a reason. Second, a date that passed with no word.">
        <g className="gf-row">
          <text x="0" y="14" className="gf-title">Moved in time</text>
          <line x1="0" y1="56" x2="360" y2="56" className="gf-line" />
          <circle cx="40" cy="56" r="4" className="gf-today" />
          <text x="40" y="78" textAnchor="middle" className="gf-label">Today</text>
          <circle cx="140" cy="56" r="6" className="gf-first" />
          <text x="140" y="78" textAnchor="middle" className="gf-label">First date</text>
          <path d="M146 48 Q212 8 272 47" className="gf-arc" fill="none" />
          <path d="M265 41 L273 48 L263 51" className="gf-arc" fill="none" />
          <text x="210" y="22" textAnchor="middle" className="gf-label">Moved, with a reason</text>
          <circle cx="280" cy="56" r="6" className="gf-new" />
          <text x="280" y="78" textAnchor="middle" className="gf-label">New date</text>
        </g>
        <g className="gf-row" transform="translate(0 92)">
          <text x="0" y="14" className="gf-title">Silent slip</text>
          <line x1="0" y1="56" x2="360" y2="56" className="gf-line" />
          <line x1="140" y1="56" x2="250" y2="56" className="gf-gap" />
          <circle cx="140" cy="56" r="6" className="gf-first gf-late" />
          <text x="140" y="78" textAnchor="middle" className="gf-label">First date</text>
          <circle cx="250" cy="56" r="4" className="gf-today gf-late" />
          <text x="250" y="78" textAnchor="middle" className="gf-label">Today</text>
          <text x="195" y="40" textAnchor="middle" className="gf-label gf-late-text">No word</text>
        </g>
      </svg>
      <figcaption>Same first date. The first task was moved in time. The second slipped.</figcaption>
    </figure>
  );
}
