'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useViewer } from './viewer';
import { markWelcomeStep } from './WelcomeCard';

import '../app/guide.css';
import { HELP, type HelpTerm } from './help';
import { SHORTCUTS } from './keys';
import { PICK, STATUS, StatusIcon, type StatusKey } from './task-ui';

// The Guide page (/guide), made pictorial on 15 Nov (the PM's call): one short section per feature, each with a picture
// of the real screen, two short clips where a picture is not enough, and plain words only for what is not obvious.
// The pictures come from a demo copy with made-up people only (scripts/guide-shots.cjs retakes them). The status words
// come from help.ts and the keys from keys.ts, so neither can drift from the app.

// The section headings, in order. The test pins these and the page renders them as its h2 elements.
export const GUIDE_SECTIONS = [
  { id: 'claude', title: 'Connect Claude' },
  { id: 'help', title: 'Help and shortcuts' },
  { id: 'home', title: 'Your Home' },
  { id: 'adding', title: 'Adding tasks' },
  { id: 'statuses', title: 'The five statuses' },
  { id: 'dates', title: 'Dates and pushes' },
  { id: 'projects', title: 'Projects' },
  { id: 'minutes', title: 'Meeting minutes' },
  { id: 'personal', title: 'Personal' },
  { id: 'team', title: 'Team' },
] as const;

const MCP_URL = 'https://nico-desk.vercel.app/api/mcp';

type Id = (typeof GUIDE_SECTIONS)[number]['id'];
const title = (id: Id) => GUIDE_SECTIONS.find((s) => s.id === id)!.title;

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

// One feature: its picture (or a short clip) and a few words. `go` opens that screen.
function Shot({ src, alt, w, h, small = false }: { src: string; alt: string; w: number; h: number; small?: boolean }) {
  return <img className={`gshot${small ? ' gshot-small' : ''}`} src={`/guide/${src}`} alt={alt} width={w} height={h} loading="lazy" decoding="async" />;
}
function Clip({ src, label }: { src: string; label: string }) {
  return <video className="gshot gclip" src={`/guide/${src}`} aria-label={label} autoPlay muted loop playsInline preload="metadata" />;
}
function Section({ id, emoji, children, go }: { id: Id; emoji: string; children: React.ReactNode; go?: { href: string; label: string } }) {
  return (
    <section id={id} aria-labelledby={`g-${id}`} className="gsec">
      <h2 id={`g-${id}`}>{title(id)}</h2>
      <span className="gsec-emoji" aria-hidden>{emoji}</span>
      {children}
      {go && <p className="gsec-go"><Link href={go.href}>{go.label} →</Link></p>}
    </section>
  );
}

export function GuideView() {
  const { meId } = useViewer();
  useEffect(() => { if (meId) markWelcomeStep(meId, 'guide'); }, [meId]); // ticks the welcome card's first step
  // The clips stop under reduced motion: they show their first frame instead.
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    root.current?.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); v.controls = true; });
  }, []);
  return (
    <article className="guide calm" ref={root}>
      <header className="page-head">
        <div>
          <h1>How to use NicoDesk</h1>
          <p className="summary">One place for who is doing what, and by when. Two minutes, with pictures.</p>
        </div>
      </header>

      <nav className="gtoc" aria-label="On this page">
        {GUIDE_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
      </nav>

      {/* The two most asked: Claude and the shortcuts, first (the PM's call, 15 Nov). */}
      <Section id="claude" emoji="✨">
        <p>Ask Claude about your work, like &ldquo;What are my open tasks?&rdquo;. Claude sees only what you can see.</p>
        <ol className="gsteps">
          <li><b>1</b><span>In Claude, open <b>Settings</b>, then <b>Connectors</b>.</span></li>
          <li><b>2</b><span>Choose <b>Add custom connector</b>. Name it NicoDesk. Paste <code className="guide-url">{MCP_URL}</code></span></li>
          <li><b>3</b><span>Press <b>Connect</b>, sign in with your NicoDesk Google account, and approve.</span></li>
        </ol>
        <p>Its changes show &ldquo;via Claude&rdquo; in the history.</p>
      </Section>

      <Section id="help" emoji="❓">
        <p>Press <b>?</b> at the top right. Any word with a dotted line then explains itself.</p>
        <dl className="keylist guide-keys">
          {SHORTCUTS.map(([k, what]) => (<div key={k}><dt><kbd className="kbd-key">{k}</kbd></dt><dd>{what}</dd></div>))}
        </dl>
      </Section>

      <Section id="home" emoji="🏠" go={{ href: '/me', label: 'Open Home' }}>
        <p>Your day at a glance. Your tasks by when they are due, what is waiting on you, and what changed.</p>
        <Shot src="home.webp" alt="Home: a greeting, what is waiting on you, and tasks for next week and later." w={1100} h={653} />
      </Section>

      <Section id="adding" emoji="✍️">
        <p>Type or say it the way you&rsquo;d tell someone, like &ldquo;Kabir to send the swatches by Friday&rdquo;. NicoDesk fills in the owner and the date.</p>
        <div className="gpair">
          <Shot src="quickadd.webp" alt="Quick Add with a task typed in." w={900} h={211} />
          <Clip src="quickadd-clip.webm" label="A task typed into Quick Add and added." />
        </div>
      </Section>

      <Section id="statuses" emoji="🚦">
        <p>Every task has one. Click the status to change it.</p>
        <div className="gpair gpair-side">
          <dl className="guide-defs">
            {PICK.map((s: StatusKey) => (
              <div key={s}>
                <dt><span className={`st st-status tone-${STATUS[s].tone}`}><StatusIcon s={s} />{STATUS[s].word}</span></dt>
                <dd>{helpRest(`status_${s}`)}</dd>
              </div>
            ))}
            {FLAGS.map((f) => (
              <div key={f.term}>
                <dt><b>{f.word}</b></dt>
                <dd>{helpRest(f.term)} The app works this out from the date.</dd>
              </div>
            ))}
          </dl>
          <Shot src="status.webp" alt="A task's status menu, with Blocked, Dropped, Move date and Ask for update." w={520} h={632} small />
        </div>
      </Section>

      <Section id="dates" emoji="📅">
        <p className="guide-rule">Push a date before it passes, and say why.</p>
        <p>A pushed date is fine. The reason shows under the task, so everyone knows. A date that passes in silence is a miss.</p>
        <Shot src="pushed.webp" alt="A task pushed once, with its reason under the name." w={1000} h={106} />
        <DateMoveFigure />
      </Section>

      <Section id="projects" emoji="📁" go={{ href: '/projects', label: 'Open Projects' }}>
        <Shot src="project.webp" alt="A project page: its people, the counts, and its task list." w={1100} h={705} />
        <ul className="guide-list">
          <li><b>The tiles</b> filter the list. Press Late to see only late tasks.</li>
          <li><b>Owner and lead.</b> The owner is accountable for the project. The lead runs it day to day. Sometimes they are the same person.</li>
          <li><b>Settings</b> is open to everyone on it. Members can add people. The owner and lead change the rest.</li>
          <li><b>Archive</b> needs a reason. Not the owner or lead? You can ask them to archive it.</li>
        </ul>
      </Section>

      <Section id="minutes" emoji="📝">
        <p>Paste your meeting notes, or connect your own Google to bring in Meet notes and Docs. Next steps become suggestions. Nothing is added until someone accepts it.</p>
        <Shot src="minutes.webp" alt="Import meeting minutes, with Paste open." w={900} h={514} />
      </Section>

      <Section id="personal" emoji="🔒">
        <p>Your own corner, under Projects. Only you can see it. Quick to-dos, a date only if you want one, and notes that save as you type.</p>
        <div className="gpair">
          <Shot src="personal.webp" alt="Personal: three of your own tasks, and your notes below." w={1100} h={705} />
          <Clip src="note-to-task-clip.webm" label="A line in the notes made a task with one click." />
        </div>
        <p className="gsec-tip">Tip: put your cursor on a note line and press <b>→ Task</b>. It becomes a task.</p>
      </Section>

      <Section id="team" emoji="👥" go={{ href: '/team', label: 'Open Team' }}>
        <p>Everyone&rsquo;s open tasks this week, by status or by person. Click a status heading to fold it away.</p>
        <Shot src="team.webp" alt="Team, by status." w={1100} h={653} />
      </Section>
    </article>
  );
}

// Two timelines, drawn small. Both start with the same first date. In the first, the owner moves it with a reason
// before it passes. In the second, today runs past the date and no one has said anything.
function DateMoveFigure() {
  return (
    <figure className="guide-fig">
      <svg viewBox="0 0 360 178" role="img" aria-label="Two timelines. First, a date pushed before it passed, with a reason. Second, a date that passed with no word.">
        <g className="gf-row">
          <text x="0" y="14" className="gf-title">Pushed in time</text>
          <line x1="0" y1="56" x2="360" y2="56" className="gf-line" />
          <circle cx="40" cy="56" r="4" className="gf-today" />
          <text x="40" y="78" textAnchor="middle" className="gf-label">Today</text>
          <circle cx="140" cy="56" r="6" className="gf-first" />
          <text x="140" y="78" textAnchor="middle" className="gf-label">First date</text>
          <path d="M146 48 Q212 8 272 47" className="gf-arc" fill="none" />
          <path d="M265 41 L273 48 L263 51" className="gf-arc" fill="none" />
          <text x="210" y="22" textAnchor="middle" className="gf-label">Pushed, with a reason</text>
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
      <figcaption>Same first date. The first task was pushed in time. The second slipped.</figcaption>
    </figure>
  );
}
