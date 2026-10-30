'use client';

import '../app/guide.css';
import { HELP, type HelpTerm } from './help';
import { SHORTCUTS } from './keys';
import { PICK, STATUS, StatusIcon, type StatusKey } from './task-ui';

// The Guide page (/guide): a short read for a team that is new to NicoDesk. It has no state. It is a client module
// only because PICK and STATUS live in task-ui.tsx, which is one. The status words come from help.ts (the same text help mode shows) and the keys from keys.ts, so neither can
// drift from the app. Everything else is written here, in plain words.

// The section headings, in order. The test pins these and the page renders them as its h2 elements.
export const GUIDE_SECTIONS = [
  { id: 'purpose', title: 'What NicoDesk is for' },
  { id: 'adding', title: 'Adding tasks' },
  { id: 'home', title: 'Your Home' },
  { id: 'statuses', title: 'The five statuses' },
  { id: 'rule', title: 'The one rule' },
  { id: 'blocked', title: 'When you are blocked' },
  { id: 'projects', title: 'Projects' },
  { id: 'leads', title: 'For leads and admins' },
  { id: 'help', title: 'Help and shortcuts' },
  { id: 'phone', title: 'On your phone' },
  { id: 'feedback', title: 'Feedback' },
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

export function GuideView() {
  return (
    <article className="guide calm">
      <header className="page-head">
        <div>
          <h1>How to use NicoDesk</h1>
          <p className="summary">One minute. Read it once, then use it.</p>
        </div>
      </header>

      <section id="purpose" aria-labelledby="g-purpose">
        <h2 id="g-purpose">{title('purpose')}</h2>
        <p>One place to see who is doing what, and by when. Every task has one owner and one date.</p>
      </section>

      <section id="adding" aria-labelledby="g-adding">
        <h2 id="g-adding">{title('adding')}</h2>
        <ul className="guide-list">
          <li><b>Quick Add.</b> Type or say it the way you&rsquo;d tell someone, like &ldquo;Sam to send samples by Friday&rdquo;. Add a few at once, or paste a WhatsApp chat.</li>
          <li><b>Fill it in yourself.</b> Use the form. Press + Add another task to add more in one go.</li>
        </ul>
      </section>

      <section id="home" aria-labelledby="g-home">
        <h2 id="g-home">{title('home')}</h2>
        <ul className="guide-list">
          <li>Your tasks, sorted into Late, Today, This week and Later.</li>
          <li><b>Updates for you.</b> Changes others made to your tasks.</li>
          <li><b>Waiting on you.</b> Tasks stuck until you act.</li>
          <li>Finish today&rsquo;s tasks and you get a little cheer.</li>
        </ul>
      </section>

      <section id="statuses" aria-labelledby="g-statuses">
        <h2 id="g-statuses">{title('statuses')}</h2>
        <p>You pick one for every task.</p>
        <dl className="guide-defs">
          {PICK.map((s: StatusKey) => (
            <div key={s}>
              <dt><span className={`st st-status tone-${STATUS[s].tone}`}><StatusIcon s={s} />{STATUS[s].word}</span></dt>
              <dd>{helpRest(`status_${s}`)}</dd>
            </div>
          ))}
        </dl>
        <p>The app works these out from the dates. You never pick them.</p>
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
        <p>A moved date is fine. A date that passes in silence is a miss.</p>
        <DateMoveFigure />
      </section>

      <section id="blocked" aria-labelledby="g-blocked">
        <h2 id="g-blocked">{title('blocked')}</h2>
        <p>Set the task to Blocked and say who you are waiting on. They see it on their Home.</p>
      </section>

      <section id="projects" aria-labelledby="g-projects">
        <h2 id="g-projects">{title('projects')}</h2>
        <ul className="guide-list">
          <li>Press a tile, like Late or Done, to filter the list.</li>
          <li><b>Added since.</b> Pick Today to review everything added in a meeting.</li>
          <li><b>Done.</b> See finished tasks and when they were done.</li>
        </ul>
      </section>

      <section id="leads" aria-labelledby="g-leads">
        <h2 id="g-leads">{title('leads')}</h2>
        <ul className="guide-list">
          <li><b>Team.</b> Everyone&rsquo;s open tasks.</li>
          <li><b>Ledger.</b> Who kept their dates.</li>
          <li><b>Reminders.</b> Drafts a nudge in your Gmail. You press Send.</li>
          <li><b>Roster.</b> Add and edit people.</li>
        </ul>
      </section>

      <section id="help" aria-labelledby="g-help">
        <h2 id="g-help">{title('help')}</h2>
        <p>Press ? at the top right. Any word with a dotted line then explains itself.</p>
        <dl className="keylist guide-keys">
          {SHORTCUTS.map(([k, what]) => (<div key={k}><dt><kbd className="kbd-key">{k}</kbd></dt><dd>{what}</dd></div>))}
        </dl>
      </section>

      <section id="phone" aria-labelledby="g-phone">
        <h2 id="g-phone">{title('phone')}</h2>
        <ul className="guide-list">
          <li><b>iPhone.</b> Open it in Safari. Tap Share, then Add to Home Screen.</li>
          <li><b>Android.</b> Open it in Chrome. Tap the menu, then Install app.</li>
        </ul>
      </section>

      <section id="feedback" aria-labelledby="g-feedback">
        <h2 id="g-feedback">{title('feedback')}</h2>
        <p>Press Feedback at the top. Anyone can reply, +1 or mark a note Done. Switch to Resolved to see what is closed.</p>
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
