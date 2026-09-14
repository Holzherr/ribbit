# Ribbit Notes Foundation Implementation Plan (phases 0-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A React + Storybook notes UI, hosted in a new window of the forked Frog app, that lists and shows real meeting notes over a typed JSON bridge, replacing the SwiftUI Notes tab.

**Architecture:** The Swift engine (recorder, tap, transcriber, diarizer, summarizer, JSON store) is untouched. A new `NotesWindow` hosts a `WKWebView` that loads a single-file Vite bundle from `web/notes`. `Bridge.swift` turns `{id,type,payload}` messages into engine calls and pushes events back with `ribbit.receive(...)`. Every visual piece is a Storybook brick with a mock bridge before it meets Swift.

**Tech Stack:** Swift 6 / SwiftPM / AppKit / WebKit (macOS 26, built with Xcode 26.6 via `DEVELOPER_DIR`), React 19, TypeScript, Vite 7, `vite-plugin-singlefile`, Tailwind 4, class-variance-authority, lucide-react, Storybook 10 (react-vite), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-14-granola-notes-ui-design.md`

## Global Constraints

- Build the Swift side with `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` in every shell; the default CLT is Swift 6.0.3 and `Package.swift` needs 6.2+.
- Never rename the bundle id `ai.learnvector.voicepet` (macOS permissions are keyed on it).
- Never commit `build/`, `.build/`, `web/dist*`, `web/notes/dist*`, `web/notes/node_modules/`, `web/notes/storybook-static/`.
- The three.js frog in `web/src/main.js` is not touched by this plan.
- Existing `Note` JSON on disk must keep decoding after the model change (new fields default).
- Story conventions: CSF3, `satisfies Meta<typeof X>`, `title: 'Shared/UI/X'` or `'<Feature>/X'`, and a `parameters.docs.description.component` describing the visual layout.
- Bricks are props in, callbacks out, no fetching. Only screens receive a `Bridge`.
- Commit messages: Conventional Commits, no AI attribution lines except the `Claude-Session:` trailer the harness requires.
- Work happens in the worktree `~/Documents/GitHub/ribbit-notes` on branch `feat/notes-ui`. Push after every commit.

---

## File structure

```
web/notes/
  package.json  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json  index.html
  .storybook/main.ts  .storybook/preview.tsx
  DESIGN.md
  src/main.tsx                       mounts <App bridge={createWKBridge()} />
  src/App.tsx                        route state: library | note | settings (session comes in plan 2)
  src/styles/tailwind.css            tokens (@theme) + base
  src/test/setup.ts
  src/shared/utils/ui-utils.ts       cn()
  src/shared/utils/format.ts         mmss(), dayLabel(), initials()
  src/shared/utils/format.test.ts
  src/shared/components/ui/          button, icon-button, chip, speaker-chip, status-pill, search-input, tabs, empty-state, markdown (+ stories)
  src/shared/brand/wordmark.tsx      + palette.stories.tsx, wordmark.stories.tsx
  src/bridge/types.ts                Note, Segment, Attendee, CalendarEvent, Settings, Commands, Events, Bridge
  src/bridge/wk.ts                   createWKBridge(): window.webkit transport
  src/bridge/mock.ts                 createMockBridge(fixtures): in-memory transport for stories/tests
  src/bridge/mock.test.ts
  src/fixtures/notes.ts              three notes
  src/features/library/model.ts      filterNotes(), groupByDay()   (+ model.test.ts)
  src/features/library/components/   note-row, day-header, note-list, library-screen (+ stories)
  src/features/note/model.ts         renameSpeaker(), speakerLabel(), turnsWithNames()   (+ model.test.ts)
  src/features/note/components/      note-header, transcript-turn, transcript-feed, summary-view, note-detail-screen (+ stories)

Sources/VoicePet/
  Store.swift          Note gains jots, enhanced, template, attendees, calendarEventID (custom decoder)
  Bridge.swift         (new) WKScriptMessageHandler + dispatcher
  NotesWindow.swift    (new) NSWindow + WKWebView
  AppDelegate.swift    lazy var notesWindow; --notes debug flag
  StatusBar.swift      "Notes…" menu item
  Hub.swift            NotesView/NoteRow/NoteDetail/NotesText removed; Notes tab = launcher

build.sh               builds web/notes and copies dist/index.html to Contents/Resources/notes/
.gitignore             web/notes ignores
```

---

## Phase 0: verify the vanilla fork

### Task 0.1: Build and run vanilla Frog, record one call

**Files:** none changed.

- [ ] **Step 1: Build**

```bash
cd ~/Documents/GitHub/ribbit-notes
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
(cd web && npm install) && ./build.sh
```
Expected: `Build complete!` and `Built build/VoicePet.app`. First build is ~7 minutes (llama.cpp).

- [ ] **Step 2: Install and launch**

```bash
rm -rf ~/Applications/VoicePet.app && cp -R build/VoicePet.app ~/Applications/ && open ~/Applications/VoicePet.app
```
Grant Microphone, Speech Recognition, Accessibility when asked. In System Settings › Keyboard set "Press 🌐 key to" → Do Nothing.

- [ ] **Step 3: Record a real call**

Right-click the frog → Notes → Start. Start a FaceTime call to yourself from a phone (or a Google Meet with a second device), talk for 60 s on both ends, then Stop. Grant System Audio Recording when asked. Wait for "processing" to finish.

Expected: a note appears with turns labelled Me and Speaker 1, a title and a summary (summary needs Apple Intelligence on, or a Claude key in Me). If only "Me" appears, System Audio Recording was denied: System Settings › Privacy & Security › Screen & System Audio Recording → enable VoicePet, restart the app, repeat.

- [ ] **Step 4: Note the on-disk layout**

```bash
ls ~/Library/Application\ Support/VoicePet/ ~/Library/Application\ Support/VoicePet/notes/*
python3 -c "import json;d=json.load(open('$HOME/Library/Application Support/VoicePet/notes.json'));print(list(d[0].keys()))"
```
Expected keys: `date duration error id segments speakerNames status summary title`. These are the fields the bridge must keep.

No commit for this task.

---

## Phase 1: web/notes scaffold and bricks

### Task 1.1: Scaffold web/notes with Vite, Tailwind, Storybook, Vitest

**Files:**
- Create: `web/notes/package.json`, `web/notes/vite.config.ts`, `web/notes/tsconfig.json`, `web/notes/tsconfig.app.json`, `web/notes/tsconfig.node.json`, `web/notes/index.html`, `web/notes/.storybook/main.ts`, `web/notes/.storybook/preview.tsx`, `web/notes/src/main.tsx`, `web/notes/src/App.tsx`, `web/notes/src/styles/tailwind.css`, `web/notes/src/test/setup.ts`, `web/notes/src/shared/utils/ui-utils.ts`, `web/notes/DESIGN.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `cn(...inputs)` in `src/shared/utils/ui-utils.ts`; Tailwind tokens `brand`, `brand-soft`, `brand-ink`, `ink`, `body`, `muted`, `faint`, `line`, `line-soft`, `surface`, `canvas`, `well`, `rec`, `rec-soft`, `danger`, `warn`; radii `card`, `control`, `pill`.

- [ ] **Step 1: package.json**

```json
{
  "name": "ribbit-notes",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5211 --strictPort",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "storybook": "storybook dev -p 6007",
    "build-storybook": "storybook build -o storybook-static",
    "test": "vitest run",
    "check-types": "tsc --noEmit -p tsconfig.app.json"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.540.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwind-merge": "^3.3.0",
    "tailwindcss": "^4.1.0"
  },
  "devDependencies": {
    "@storybook/addon-a11y": "^10.0.0",
    "@storybook/addon-docs": "^10.0.0",
    "@storybook/react-vite": "^10.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^26.0.0",
    "storybook": "^10.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "vite-plugin-singlefile": "^2.3.0",
    "vitest": "^3.2.0"
  }
}
```
Run `cd web/notes && npm install`. If npm reports a peer conflict for Storybook or Vite, take the versions it suggests; the exact numbers are not load-bearing, the majors are.

- [ ] **Step 2: vite.config.ts**

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html so WKWebView can load it from file:// with no CORS issues (same trick as ../vite.config.js).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', emptyOutDir: true, minify: true, assetsInlineLimit: 30_000_000 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.@(ts|tsx)'] },
});
```

- [ ] **Step 3: tsconfig files**

`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
```
`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] },
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", ".storybook"]
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: index.html, main.tsx, App.tsx, tailwind.css, setup.ts, ui-utils.ts**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ribbit Notes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tailwind.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```
`src/App.tsx` (placeholder for this task; replaced in Task 2.4):
```tsx
export function App() {
  return <div className="p-6 text-ink">Ribbit Notes</div>;
}
```
`src/styles/tailwind.css`:
```css
@import 'tailwindcss';

/* Design tokens. Mirrors DESIGN.md; every component takes colour and radius from here. */
@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  --color-brand: #1f9d55;
  --color-brand-hover: #17803f;
  --color-brand-soft: #e9f7ee;
  --color-brand-ink: #14683a;

  --color-ink: #0f172a;
  --color-body: #475569;
  --color-muted: #64748b;
  --color-faint: #94a3b8;
  --color-line: #e2e8f0;
  --color-line-soft: #f1f5f9;
  --color-surface: #ffffff;
  --color-canvas: #f8fafc;
  --color-well: #eef2f7;

  --color-rec: #dc2626;
  --color-rec-soft: #fee2e2;
  --color-danger: #b91c1c;
  --color-warn: #b45309;
  --color-warn-soft: #fffbeb;

  --radius-card: 12px;
  --radius-control: 8px;
  --radius-pill: 999px;
}

@layer base {
  body {
    @apply bg-canvas text-ink font-sans antialiased text-[14px];
    -webkit-user-select: none;
    user-select: none;
  }
  button { @apply cursor-default; }
  textarea, input, [data-selectable] { -webkit-user-select: text; user-select: text; }
}
```
`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```
`src/shared/utils/ui-utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Storybook config**

`.storybook/main.ts`:
```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  // Storybook reuses vite.config.ts; the singlefile plugin must not run there.
  viteFinal: config => ({ ...config, base: './', plugins: (config.plugins ?? []).flat().filter(p => !(p && typeof p === 'object' && 'name' in p && String((p as { name: string }).name).includes('singlefile'))) }),
};
export default config;
```
`.storybook/preview.tsx`:
```tsx
import type { Preview } from '@storybook/react-vite';
import '../src/styles/tailwind.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
    backgrounds: { options: { app: { name: 'app', value: '#f8fafc' }, white: { name: 'white', value: '#ffffff' } } },
    viewport: { options: { window: { name: 'Notes window', styles: { width: '960px', height: '640px' }, type: 'desktop' } } },
  },
  initialGlobals: { backgrounds: { value: 'app' } },
};
export default preview;
```

- [ ] **Step 6: DESIGN.md**

```markdown
---
name: Ribbit Notes
description: A notes window that stays out of the way during a call. Near-white canvas, slate ink, one green for the primary action, red only for the recording dot. Dense rows, system font, tabular timestamps.
colors:
  brand: '#1f9d55'
  brand-hover: '#17803f'
  brand-soft: '#e9f7ee'
  brand-ink: '#14683a'
  ink: '#0f172a'
  body: '#475569'
  muted: '#64748b'
  faint: '#94a3b8'
  line: '#e2e8f0'
  line-soft: '#f1f5f9'
  surface: '#ffffff'
  canvas: '#f8fafc'
  well: '#eef2f7'
  rec: '#dc2626'
  rec-soft: '#fee2e2'
  danger: '#b91c1c'
  warn: '#b45309'
  warn-soft: '#fffbeb'
typography:
  title: { fontSize: '17px', fontWeight: 700, lineHeight: 1.2 }
  row-name: { fontSize: '14px', fontWeight: 600 }
  body: { fontSize: '14px', lineHeight: 1.5 }
  label: { fontSize: '12px', color: '{colors.muted}' }
  timestamp: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: '{colors.faint}' }
rounded: { card: '12px', control: '8px', pill: '999px' }
spacing: { row-pad: '10px 12px', screen-pad: '16px', sidebar: '280px', window-min: '720x480', window-default: '960x640' }
rules:
  - One brand-filled button per screen (Start / Stop / Enhance).
  - Red is the recording dot and nothing else.
  - Speaker chips are outlined, tinted by speaker index (me = brand, s1 = sky, s2 = violet, s3 = amber, s4+ = slate).
---
```

- [ ] **Step 7: .gitignore additions**

Append to the repo `.gitignore`:
```
web/notes/node_modules/
web/notes/dist/
web/notes/storybook-static/
```

- [ ] **Step 8: Verify**

```bash
cd web/notes && npm run check-types && npm run build && ls -la dist/index.html && npx vitest run --passWithNoTests
```
Expected: type check clean, `dist/index.html` exists (single file), vitest reports no tests. Then `npm run storybook` starts on :6007 with an empty sidebar (Ctrl-C after it opens).

- [ ] **Step 9: Commit**

```bash
git add web/notes .gitignore
git commit -m "feat(notes): scaffold web/notes with Vite, Tailwind 4, Storybook 10, Vitest"
git push
```

---

### Task 1.2: Bridge types, fixtures, and mock transport

**Files:**
- Create: `web/notes/src/bridge/types.ts`, `web/notes/src/bridge/mock.ts`, `web/notes/src/bridge/mock.test.ts`, `web/notes/src/fixtures/notes.ts`

**Interfaces:**
- Produces: everything in `types.ts` below; `createMockBridge(seed?: Note[]): MockBridge` where `MockBridge extends Bridge { emit<E extends keyof Events>(type: E, payload: Events[E]): void; notes: Note[] }`; `FIXTURE_NOTES: Note[]` (three notes: ready, processing, failed).

- [ ] **Step 1: types.ts**

```ts
// Mirror of Sources/VoicePet/Store.swift (Note, Segment) plus the bridge contract in the spec.
export interface Segment { id: string; speaker: string; start: number; end: number; text: string }
export interface Attendee { name: string; email?: string }
export type NoteStatus = 'recording' | 'processing' | 'ready' | 'failed' | 'enhancing';

export interface Note {
  id: string;
  date: string;              // ISO 8601
  title: string;
  duration: number;          // seconds
  summary: string;
  segments: Segment[];
  speakerNames: Record<string, string>;
  status: NoteStatus;
  error?: string | null;
  jots: string;
  enhanced: string;
  template: string;
  attendees: Attendee[];
  calendarEventID?: string | null;
}

export interface CalendarEvent { id: string; title: string; start: string; end: string; attendees: Attendee[] }

export interface Settings {
  speechEngine: 'apple' | 'parakeet';
  summaryEngine: 'claude' | 'apple';
  hasClaudeKey: boolean;
  calendarEnabled: boolean;
  callDetection: Record<string, boolean>;   // bundle id -> on
  showFrog: boolean;
}

export interface SessionStatus { recording: boolean; processing: boolean; noteId: string | null; elapsed: number }

export interface Commands {
  'notes.list': { payload: undefined; reply: Note[] };
  'notes.get': { payload: { id: string }; reply: Note };
  'notes.update': { payload: { id: string; patch: Partial<Note> }; reply: Note };
  'notes.delete': { payload: { id: string }; reply: 'ok' };
  'session.start': { payload: { title?: string; calendarEventID?: string }; reply: { noteId: string } };
  'session.stop': { payload: undefined; reply: 'ok' };
  'session.status': { payload: undefined; reply: SessionStatus };
  'calendar.upcoming': { payload: { hours: number }; reply: CalendarEvent[] };
  'calendar.authorize': { payload: undefined; reply: { granted: boolean } };
  'enhance.run': { payload: { id: string; template: string }; reply: { enhanced: string } };
  'chat.ask': { payload: { id: string; question: string }; reply: { answer: string } };
  'export.copy': { payload: { id: string; what: 'enhanced' | 'transcript' | 'jots' }; reply: 'ok' };
  'settings.get': { payload: undefined; reply: Settings };
  'settings.set': { payload: Partial<Settings>; reply: Settings };
  'window.close': { payload: undefined; reply: 'ok' };
}

export interface Events {
  'session.tick': { noteId: string; elapsed: number; level: number };
  'transcript.segment': { noteId: string; segment: Segment };
  'note.updated': Note;
  'call.detected': { app: string; event?: CalendarEvent };
  'error': { message: string };
}

export type CommandType = keyof Commands;
export type EventType = keyof Events;

export interface Bridge {
  call<K extends CommandType>(type: K, payload: Commands[K]['payload']): Promise<Commands[K]['reply']>;
  on<E extends EventType>(type: E, handler: (payload: Events[E]) => void): () => void;
}

// Wire format shared with Bridge.swift.
export interface WireCommand { id: string; type: CommandType; payload?: unknown }
export interface WireReply { id: string; ok: boolean; payload?: unknown; error?: string }
export interface WireEvent { type: EventType; payload: unknown }
```

- [ ] **Step 2: fixtures/notes.ts**

```ts
import type { Note } from '@/bridge/types';

const h = 3600_000;
const now = Date.now();

export const FIXTURE_NOTES: Note[] = [
  {
    id: 'n-ready', date: new Date(now - 20 * h).toISOString(), title: 'Cat sitter marketplace kickoff', duration: 1520,
    status: 'ready', error: null, template: 'default', calendarEventID: null,
    speakerNames: { me: 'Me', s1: 'Fiona' },
    attendees: [{ name: 'Fiona Park', email: 'fiona@example.com' }],
    jots: '- owners first?\n- pricing next week\n- landing page before outreach',
    summary: '# Cat sitter marketplace kickoff\n\n**TL;DR** Fiona walked through the marketplace idea; agreed to start with owners in San Francisco.\n\n## Key points\n- Owners first, sitters via vet clinics\n- Pricing deferred to next week\n\n## Decisions\n- Start in San Francisco\n\n## Action items\n- Fiona: landing page copy by Friday\n- Me: talk to three vet clinics',
    enhanced: '# Cat sitter marketplace kickoff\n\n**TL;DR** Start with cat owners in San Francisco and recruit sitters through vet clinics. Pricing is next week.\n\n## Your notes, expanded\n- **Owners first?** Yes. Fiona wants owners as the first customer; sitters come through clinics.\n- **Pricing next week.** Deferred, nobody owns it yet.\n- **Landing page before outreach.** Fiona drafts copy by Friday.\n\n## Action items\n- Fiona: landing page copy by Friday\n- Me: talk to three vet clinics',
    segments: [
      { id: 'g1', speaker: 's1', start: 0, end: 8, text: 'Hi, thanks for making time. I wanted to walk you through the cat sitter marketplace idea and get your take on the go to market plan.' },
      { id: 'g2', speaker: 'me', start: 8, end: 17, text: 'Sure, happy to. My first question is who the customer is. Is it the cat owner, or the sitter?' },
      { id: 'g3', speaker: 's1', start: 17, end: 26, text: 'Good point. I think we start with owners in San Francisco, and we recruit sitters through vet clinics. We can decide on pricing next week.' },
      { id: 'g4', speaker: 'me', start: 26, end: 32, text: 'Okay. Action item for me: talk to three clinics. And you draft the landing page copy by Friday.' },
    ],
  },
  {
    id: 'n-processing', date: new Date(now - 0.5 * h).toISOString(), title: 'Dylan hiring sync', duration: 2210,
    status: 'processing', error: null, template: 'one-to-one', calendarEventID: 'cal-2',
    speakerNames: { me: 'Me' }, attendees: [{ name: 'Dylan Reyes' }],
    jots: 'five JDs reviewed\nsenior eng first', summary: '', enhanced: '', segments: [],
  },
  {
    id: 'n-failed', date: new Date(now - 50 * h).toISOString(), title: 'Quiet meeting', duration: 40,
    status: 'failed', error: "I didn't hear any speech.", template: 'default', calendarEventID: null,
    speakerNames: { me: 'Me' }, attendees: [], jots: '', summary: '', enhanced: '', segments: [],
  },
];

export const FIXTURE_EVENTS = [
  { id: 'cal-1', title: 'Weekly with Priya', start: new Date(now + 1 * h).toISOString(), end: new Date(now + 1.5 * h).toISOString(), attendees: [{ name: 'Priya Shah', email: 'priya@example.com' }] },
  { id: 'cal-2', title: 'Dylan hiring sync', start: new Date(now + 4 * h).toISOString(), end: new Date(now + 5 * h).toISOString(), attendees: [{ name: 'Dylan Reyes' }] },
];

export const FIXTURE_SETTINGS = {
  speechEngine: 'apple' as const, summaryEngine: 'claude' as const, hasClaudeKey: false,
  calendarEnabled: true, callDetection: { 'us.zoom.xos': true, 'com.apple.FaceTime': true }, showFrog: true,
};
```

- [ ] **Step 3: mock.test.ts (write first)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { createMockBridge } from './mock';

describe('createMockBridge', () => {
  it('lists seeded notes without segments', async () => {
    const b = createMockBridge(FIXTURE_NOTES);
    const list = await b.call('notes.list', undefined);
    expect(list).toHaveLength(3);
    expect(list[0].segments).toEqual([]);
  });

  it('gets a full note and applies patches', async () => {
    const b = createMockBridge(FIXTURE_NOTES);
    const full = await b.call('notes.get', { id: 'n-ready' });
    expect(full.segments).toHaveLength(4);
    const updated = await b.call('notes.update', { id: 'n-ready', patch: { title: 'Renamed' } });
    expect(updated.title).toBe('Renamed');
    expect((await b.call('notes.get', { id: 'n-ready' })).title).toBe('Renamed');
  });

  it('rejects unknown ids', async () => {
    const b = createMockBridge([]);
    await expect(b.call('notes.get', { id: 'nope' })).rejects.toThrow('not found');
  });

  it('delivers emitted events and unsubscribes', () => {
    const b = createMockBridge([]);
    const h = vi.fn();
    const off = b.on('error', h);
    b.emit('error', { message: 'x' });
    off();
    b.emit('error', { message: 'y' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('starts and stops a session', async () => {
    const b = createMockBridge([]);
    const { noteId } = await b.call('session.start', { title: 'T' });
    expect((await b.call('session.status', undefined)).recording).toBe(true);
    await b.call('session.stop', undefined);
    expect((await b.call('notes.get', { id: noteId })).status).toBe('processing');
  });
});
```

- [ ] **Step 4: Run to see it fail**

Run: `cd web/notes && npx vitest run src/bridge/mock.test.ts`
Expected: FAIL, cannot resolve `./mock`.

- [ ] **Step 5: mock.ts**

```ts
import { FIXTURE_EVENTS, FIXTURE_SETTINGS } from '@/fixtures/notes';
import type { Bridge, CommandType, Commands, Events, EventType, Note, Settings } from './types';

export interface MockBridge extends Bridge {
  emit<E extends EventType>(type: E, payload: Events[E]): void;
  notes: Note[];
}

/** In-memory bridge for Storybook and tests. Answers every command from fixtures; `emit` fakes Swift events. */
export function createMockBridge(seed: Note[] = [], opts: { latency?: number } = {}): MockBridge {
  const notes: Note[] = seed.map(n => structuredClone(n));
  const handlers = new Map<EventType, Set<(p: never) => void>>();
  let settings: Settings = { ...FIXTURE_SETTINGS };
  let session: { noteId: string; startedAt: number } | null = null;
  const wait = () => new Promise(r => setTimeout(r, opts.latency ?? 0));
  const find = (id: string) => { const n = notes.find(x => x.id === id); if (!n) throw new Error(`note ${id} not found`); return n; };

  const bridge: MockBridge = {
    notes,
    async call(type, payload) {
      await wait();
      const p = payload as never;
      const impl: { [K in CommandType]: (p: Commands[K]['payload']) => Commands[K]['reply'] } = {
        'notes.list': () => notes.map(n => ({ ...n, segments: [] })),
        'notes.get': ({ id }) => structuredClone(find(id)),
        'notes.update': ({ id, patch }) => { const n = find(id); Object.assign(n, patch); bridge.emit('note.updated', structuredClone(n)); return structuredClone(n); },
        'notes.delete': ({ id }) => { const i = notes.findIndex(x => x.id === id); if (i >= 0) notes.splice(i, 1); return 'ok'; },
        'session.start': ({ title, calendarEventID }) => {
          const n: Note = { id: `n-${Date.now()}`, date: new Date().toISOString(), title: title ?? 'Untitled', duration: 0, summary: '', segments: [], speakerNames: { me: 'Me' }, status: 'recording', error: null, jots: '', enhanced: '', template: 'default', attendees: [], calendarEventID: calendarEventID ?? null };
          notes.unshift(n); session = { noteId: n.id, startedAt: Date.now() };
          return { noteId: n.id };
        },
        'session.stop': () => { if (session) { const n = find(session.noteId); n.status = 'processing'; n.duration = (Date.now() - session.startedAt) / 1000; session = null; bridge.emit('note.updated', structuredClone(n)); } return 'ok'; },
        'session.status': () => ({ recording: !!session, processing: notes.some(n => n.status === 'processing'), noteId: session?.noteId ?? null, elapsed: session ? (Date.now() - session.startedAt) / 1000 : 0 }),
        'calendar.upcoming': () => FIXTURE_EVENTS,
        'calendar.authorize': () => ({ granted: true }),
        'enhance.run': ({ id, template }) => { const n = find(id); n.template = template; n.enhanced = `# ${n.title}\n\n(mock enhance with template ${template})\n\n${n.jots}`; n.status = 'ready'; bridge.emit('note.updated', structuredClone(n)); return { enhanced: n.enhanced }; },
        'chat.ask': ({ question }) => ({ answer: `Mock answer to: ${question}` }),
        'export.copy': () => 'ok',
        'settings.get': () => settings,
        'settings.set': patch => { settings = { ...settings, ...patch }; return settings; },
        'window.close': () => 'ok',
      };
      return impl[type](p) as never;
    },
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as never);
      return () => { handlers.get(type)?.delete(handler as never); };
    },
    emit(type, payload) {
      handlers.get(type)?.forEach(h => (h as (p: unknown) => void)(payload));
    },
  };
  return bridge;
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/bridge/mock.test.ts`
Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add web/notes/src/bridge web/notes/src/fixtures
git commit -m "feat(notes): bridge contract types, fixtures and mock transport"
git push
```

---

### Task 1.3: Formatting helpers

**Files:**
- Create: `web/notes/src/shared/utils/format.ts`, `web/notes/src/shared/utils/format.test.ts`

**Interfaces:**
- Produces: `mmss(seconds: number): string` ("1:05", "1:02:03"), `dayLabel(iso: string, now?: Date): string` ("Today", "Yesterday", "Mon 8 Sep"), `initials(name: string): string` ("FP"), `speakerTone(speaker: string): 'brand' | 'sky' | 'violet' | 'amber' | 'slate'`.

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from 'vitest';
import { dayLabel, initials, mmss, speakerTone } from './format';

describe('format', () => {
  it('mmss', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(65)).toBe('1:05');
    expect(mmss(3723)).toBe('1:02:03');
  });
  it('dayLabel', () => {
    const now = new Date('2026-09-14T12:00:00Z');
    expect(dayLabel('2026-09-14T08:00:00Z', now)).toBe('Today');
    expect(dayLabel('2026-09-13T22:00:00Z', now)).toBe('Yesterday');
    expect(dayLabel('2026-09-08T10:00:00Z', now)).toMatch(/^Tue 8 Sep$/);
  });
  it('initials', () => {
    expect(initials('Fiona Park')).toBe('FP');
    expect(initials('Me')).toBe('M');
    expect(initials('')).toBe('?');
  });
  it('speakerTone', () => {
    expect(speakerTone('me')).toBe('brand');
    expect(speakerTone('s1')).toBe('sky');
    expect(speakerTone('s2')).toBe('violet');
    expect(speakerTone('s3')).toBe('amber');
    expect(speakerTone('s9')).toBe('slate');
  });
});
```

- [ ] **Step 2: Run, expect failure** (`npx vitest run src/shared/utils/format.test.ts`)

- [ ] **Step 3: Implement**

```ts
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

export type SpeakerTone = 'brand' | 'sky' | 'violet' | 'amber' | 'slate';
export function speakerTone(speaker: string): SpeakerTone {
  if (speaker === 'me') return 'brand';
  const n = Number(speaker.replace(/^s/, ''));
  return (['sky', 'violet', 'amber'] as const)[n - 1] ?? 'slate';
}
```

- [ ] **Step 4: Run, expect 4 passed. Commit.**

```bash
git add web/notes/src/shared/utils/format.ts web/notes/src/shared/utils/format.test.ts
git commit -m "feat(notes): mmss, dayLabel, initials, speakerTone helpers"
git push
```

---

### Task 1.4: Shared UI bricks

**Files:**
- Create in `web/notes/src/shared/components/ui/`: `button.tsx`, `button.stories.tsx`, `icon-button.tsx`, `chip.tsx`, `chip.stories.tsx`, `speaker-chip.tsx`, `speaker-chip.stories.tsx`, `status-pill.tsx`, `status-pill.stories.tsx`, `search-input.tsx`, `search-input.stories.tsx`, `tabs.tsx`, `tabs.stories.tsx`, `empty-state.tsx`, `empty-state.stories.tsx`, `markdown.tsx`, `markdown.stories.tsx`
- Create: `web/notes/src/shared/brand/wordmark.tsx`, `wordmark.stories.tsx`, `palette.stories.tsx`

**Interfaces (Produces):**
- `Button({ variant: 'brand'|'ghost'|'soft'|'text'|'danger'|'quiet', size: 'default'|'sm'|'icon'|'icon-sm', block?, ...button props })`
- `IconButton({ label: string, ...ButtonProps })` = `Button size="icon-sm" variant="quiet"` with `aria-label`
- `Chip({ tone?: 'neutral'|'brand'|'rec', children })`
- `SpeakerChip({ speaker: string, name: string, onClick? })` tinted by `speakerTone`
- `StatusPill({ status: NoteStatus })`
- `SearchInput({ value, onChange(value), placeholder? })`
- `Tabs({ items: {id,label}[], value, onChange(id) })`
- `EmptyState({ icon, title, body, action?: ReactNode })`
- `Markdown({ source: string })` renders a safe subset: `#`/`##` headings, `**bold**`, `- ` bullets, paragraphs. No HTML passthrough.
- `Wordmark({ size?: 'sm'|'lg' })`

- [ ] **Step 1: button.tsx**

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/shared/utils/ui-utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors duration-100 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        brand: 'rounded-control bg-brand text-white hover:bg-brand-hover',
        ghost: 'rounded-control border border-line bg-surface text-ink hover:bg-line-soft',
        soft: 'rounded-control bg-line-soft text-ink hover:bg-line',
        text: 'rounded-control text-brand-ink hover:bg-brand-soft',
        danger: 'rounded-control text-danger hover:bg-rec-soft',
        quiet: 'rounded-control text-muted hover:bg-line-soft hover:text-ink',
      },
      size: {
        default: 'h-8 px-3 text-[13px] [&_svg]:size-4',
        sm: 'h-7 px-2.5 text-[12px] [&_svg]:size-3.5',
        icon: 'size-8 [&_svg]:size-4',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'brand', size: 'default' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

/** Every action in the window. Desktop-dense: 32px default height. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, block, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
));
Button.displayName = 'Button';
```

- [ ] **Step 2: button.stories.tsx**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mic, Square } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Shared/UI/Button',
  component: Button,
  parameters: { docs: { description: { component: 'Rounded 32px-high button. Variants: brand (green fill, the one primary action per screen), ghost (white with border), soft (grey fill), text (green text), danger (red text), quiet (grey text). Sizes: default, sm, icon, icon-sm. `block` stretches full width.' } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'brand', children: <><Mic /> Start notes</> } };
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Button variant="brand"><Mic /> Start</Button>
      <Button variant="ghost"><Square /> Stop</Button>
      <Button variant="soft">Copy</Button>
      <Button variant="text">Enhance again</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="quiet">Cancel</Button>
      <Button size="sm">Small</Button>
    </div>
  ),
};
```

- [ ] **Step 3: icon-button.tsx, chip.tsx, speaker-chip.tsx, status-pill.tsx**

`icon-button.tsx`:
```tsx
import { Button, type ButtonProps } from './button';

/** A quiet 28px square button with an accessible label; icon is the child. */
export function IconButton({ label, ...props }: ButtonProps & { label: string }) {
  return <Button variant="quiet" size="icon-sm" aria-label={label} title={label} {...props} />;
}
```
`chip.tsx`:
```tsx
import { cn } from '@/shared/utils/ui-utils';

export type ChipTone = 'neutral' | 'brand' | 'rec';
const tones: Record<ChipTone, string> = {
  neutral: 'bg-line-soft text-body',
  brand: 'bg-brand-soft text-brand-ink',
  rec: 'bg-rec-soft text-danger',
};
/** Small rounded label. 20px high, 12px text. */
export function Chip({ tone = 'neutral', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex h-5 items-center rounded-pill px-2 text-[12px] font-medium', tones[tone], className)}>{children}</span>;
}
```
`speaker-chip.tsx`:
```tsx
import { speakerTone, type SpeakerTone } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';

const tones: Record<SpeakerTone, string> = {
  brand: 'border-brand text-brand-ink',
  sky: 'border-sky-500 text-sky-700',
  violet: 'border-violet-500 text-violet-700',
  amber: 'border-amber-500 text-amber-700',
  slate: 'border-slate-400 text-slate-600',
};
/** Outlined speaker label tinted by speaker index. Clickable when `onClick` is set (rename). */
export function SpeakerChip({ speaker, name, onClick }: { speaker: string; name: string; onClick?: () => void }) {
  const cls = cn('inline-flex h-5 items-center rounded-pill border px-2 text-[12px] font-semibold bg-surface', tones[speakerTone(speaker)], onClick && 'hover:bg-line-soft');
  return onClick ? <button type="button" className={cls} onClick={onClick} title="Rename speaker">{name}</button> : <span className={cls}>{name}</span>;
}
```
`status-pill.tsx`:
```tsx
import type { NoteStatus } from '@/bridge/types';
import { Chip } from './chip';

const map: Record<NoteStatus, { label: string; tone: 'neutral' | 'brand' | 'rec' } | null> = {
  ready: null,
  recording: { label: 'Recording', tone: 'rec' },
  processing: { label: 'Processing…', tone: 'neutral' },
  enhancing: { label: 'Enhancing…', tone: 'brand' },
  failed: { label: 'Failed', tone: 'rec' },
};
/** Chip for a note's status. Renders nothing for `ready`. Recording shows a pulsing red dot. */
export function StatusPill({ status }: { status: NoteStatus }) {
  const m = map[status];
  if (!m) return null;
  return (
    <Chip tone={m.tone}>
      {status === 'recording' && <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-rec" />}
      {m.label}
    </Chip>
  );
}
```

- [ ] **Step 4: search-input.tsx, tabs.tsx, empty-state.tsx, markdown.tsx**

`search-input.tsx`:
```tsx
import { Search, X } from 'lucide-react';

/** Rounded search field with a leading magnifier and a clear button when non-empty. 32px high. */
export function SearchInput({ value, onChange, placeholder = 'Search notes' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-faint" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-8 text-[13px] text-ink placeholder:text-faint focus:border-brand focus:outline-none"
      />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="absolute right-1.5 top-1.5 rounded-control p-0.5 text-muted hover:bg-line-soft">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
```
`tabs.tsx`:
```tsx
import { cn } from '@/shared/utils/ui-utils';

export interface TabItem { id: string; label: string }
/** Underlined tab strip. The active tab has an ink underline; others are muted. */
export function Tabs({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-line">
      {items.map(t => (
        <button key={t.id} role="tab" aria-selected={t.id === value} type="button" onClick={() => onChange(t.id)}
          className={cn('-mb-px border-b-2 px-1 pb-2 text-[13px] font-semibold', t.id === value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-body')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
```
`empty-state.tsx`:
```tsx
import type { ReactNode } from 'react';

/** Centred icon, title, one-line body and an optional action. Used when a list or a tab is empty. */
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-faint [&_svg]:size-8">{icon}</div>
      <div className="text-[15px] font-bold text-ink">{title}</div>
      <div className="max-w-sm text-[13px] text-muted">{body}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```
`markdown.tsx`:
```tsx
import { Fragment } from 'react';

/** Renders the markdown subset the summarizer and enhancer produce: #, ## headings, - bullets, **bold**, paragraphs. Text only, no HTML. */
export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-ink" data-selectable>
      {blocks.map((b, i) => <Block key={i} text={b} />)}
    </div>
  );
}

function Block({ text }: { text: string }) {
  const lines = text.split('\n');
  if (lines.every(l => /^\s*[-*] /.test(l))) {
    return <ul className="list-disc space-y-1 pl-5">{lines.map((l, i) => <li key={i}><Inline text={l.replace(/^\s*[-*] /, '')} /></li>)}</ul>;
  }
  const h = /^(#{1,3}) (.*)$/.exec(lines[0]!);
  if (h && lines.length === 1) {
    const cls = h[1]!.length === 1 ? 'text-[17px] font-bold' : 'mt-2 text-[12px] font-bold uppercase tracking-wide text-muted';
    return <div className={cls}><Inline text={h[2]!} /></div>;
  }
  return <p>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}<Inline text={l} /></Fragment>)}</p>;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>)}</>;
}
```

- [ ] **Step 5: Stories for the rest**

Each story file follows the Button pattern: `title: 'Shared/UI/<Name>'`, one `Default` story with realistic args, plus a `Variants`/`AllStatuses` render where a component has modes. Write the `docs.description.component` from the doc comment on the component. Concretely:

`speaker-chip.stories.tsx` renders `me`, `s1`, `s2`, `s3`, `s5` with names, one with `onClick`.
`status-pill.stories.tsx` renders all five statuses in a row.
`chip.stories.tsx` renders the three tones.
`search-input.stories.tsx` uses `useState` inside `render` so typing works.
`tabs.stories.tsx` uses `useState` with items Notes / Transcript / Jots.
`empty-state.stories.tsx` shows `<FileText />` icon, "No notes yet", body "Start a session before a call and both sides land here.", action `<Button>Start a session</Button>`.
`markdown.stories.tsx` renders `FIXTURE_NOTES[0].enhanced`.

- [ ] **Step 6: Wordmark and palette**

`src/shared/brand/wordmark.tsx`:
```tsx
import { cn } from '@/shared/utils/ui-utils';

/** Text wordmark "ribbit" in brand green with a small dot. Sizes sm (16px) and lg (28px). Placeholder until a mark is drawn. */
export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 font-extrabold tracking-tight text-brand-ink', size === 'lg' ? 'text-[28px]' : 'text-[16px]', className)}>
      ribbit<span className="size-1.5 self-center rounded-full bg-brand" />
    </span>
  );
}
```
`wordmark.stories.tsx`: title `'Brand/Wordmark'`, two stories `Small`, `Large`.
`palette.stories.tsx`: title `'Brand/Palette'`, one story rendering a grid of swatches for every token in DESIGN.md (`bg-brand`, `bg-brand-soft`, `bg-ink`, `bg-body`, `bg-muted`, `bg-faint`, `bg-line`, `bg-line-soft`, `bg-surface`, `bg-canvas`, `bg-well`, `bg-rec`, `bg-rec-soft`, `bg-danger`, `bg-warn`, `bg-warn-soft`) with the token name under each.

- [ ] **Step 7: Verify in Storybook**

Run: `npm run storybook`. Open Shared/UI/* and Brand/*. Every story renders with no console errors; a11y panel shows no violations on Button and SpeakerChip.
Run: `npm run check-types`. Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add web/notes/src/shared
git commit -m "feat(notes): shared UI bricks and brand stories"
git push
```

---

### Task 1.5: Library model and bricks

**Files:**
- Create: `web/notes/src/features/library/model.ts`, `model.test.ts`, `components/note-row.tsx`, `note-row.stories.tsx`, `components/day-header.tsx`, `components/note-list.tsx`, `note-list.stories.tsx`, `components/library-screen.tsx`, `library-screen.stories.tsx`

**Interfaces:**
- Consumes: `Note`, `Bridge`, `MockBridge`, `FIXTURE_NOTES`, `dayLabel`, `mmss`, `initials`, `StatusPill`, `SearchInput`, `EmptyState`, `Button`.
- Produces: `filterNotes(notes: Note[], query: string): Note[]`; `groupByDay(notes: Note[], now?: Date): { label: string; notes: Note[] }[]`; `NoteRow({ note, selected, onSelect })`; `NoteList({ notes, selectedId, onSelect, query, onQuery })`; `LibraryScreen({ bridge, onOpen(id), onStart })` which loads `notes.list`, subscribes to `note.updated`, and hosts the Start button.

- [ ] **Step 1: model.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { filterNotes, groupByDay } from './model';

describe('library model', () => {
  it('filters by title, jots, enhanced, summary and transcript, case-insensitive', () => {
    expect(filterNotes(FIXTURE_NOTES, 'CAT').map(n => n.id)).toEqual(['n-ready']);
    expect(filterNotes(FIXTURE_NOTES, 'senior eng').map(n => n.id)).toEqual(['n-processing']);
    expect(filterNotes(FIXTURE_NOTES, 'vet clinics').map(n => n.id)).toEqual(['n-ready']);
    expect(filterNotes(FIXTURE_NOTES, '')).toHaveLength(3);
  });
  it('groups newest first by day label', () => {
    const now = new Date();
    const g = groupByDay(FIXTURE_NOTES, now);
    expect(g[0]!.label).toBe('Today');
    expect(g[0]!.notes.map(n => n.id)).toEqual(['n-processing', 'n-ready']);
    expect(g[1]!.notes.map(n => n.id)).toEqual(['n-failed']);
  });
});
```
Note: `n-ready` is 20 h old and `n-processing` 0.5 h old; both may or may not be "Today" depending on the clock. Make the test deterministic: build `now` as `new Date(FIXTURE_NOTES[1].date)` plus one minute, then the first group is Today and contains only what falls on that calendar day. Adjust the expectations to whatever `groupByDay` returns for that fixed `now`, verified by hand once, and freeze it.

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: model.ts**

```ts
import type { Note } from '@/bridge/types';
import { dayLabel } from '@/shared/utils/format';

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(n => [n.title, n.jots, n.enhanced, n.summary, ...n.segments.map(s => s.text)].some(t => t.toLowerCase().includes(q)));
}

export function groupByDay(notes: Note[], now: Date = new Date()): { label: string; notes: Note[] }[] {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  const out: { label: string; notes: Note[] }[] = [];
  for (const n of sorted) {
    const label = dayLabel(n.date, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.notes.push(n); else out.push({ label, notes: [n] });
  }
  return out;
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: note-row.tsx, day-header.tsx, note-list.tsx**

`note-row.tsx`:
```tsx
import type { Note } from '@/bridge/types';
import { StatusPill } from '@/shared/components/ui/status-pill';
import { initials, mmss } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';

/** One note in the sidebar list: title, time · duration, up to three attendee initials, status pill. Selected row has a well background. */
export function NoteRow({ note, selected, onSelect }: { note: Note; selected?: boolean; onSelect: (id: string) => void }) {
  const time = new Date(note.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <button type="button" onClick={() => onSelect(note.id)} aria-current={selected ? 'true' : undefined}
      className={cn('flex w-full flex-col gap-1 rounded-card px-3 py-2.5 text-left hover:bg-line-soft', selected && 'bg-well hover:bg-well')}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{note.title}</span>
        <StatusPill status={note.status} />
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className="tabular-nums">{time}{note.duration > 0 && ` · ${mmss(note.duration)}`}</span>
        <span className="flex -space-x-1">
          {note.attendees.slice(0, 3).map(a => (
            <span key={a.name} title={a.name} className="grid size-5 place-items-center rounded-full border border-surface bg-well text-[9px] font-bold text-body">{initials(a.name)}</span>
          ))}
        </span>
      </div>
    </button>
  );
}
```
`day-header.tsx`:
```tsx
/** Muted uppercase day label above a group of rows. */
export function DayHeader({ label }: { label: string }) {
  return <div className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-faint">{label}</div>;
}
```
`note-list.tsx`:
```tsx
import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SearchInput } from '@/shared/components/ui/search-input';
import { FileText } from 'lucide-react';
import { filterNotes, groupByDay } from '../model';
import { DayHeader } from './day-header';
import { NoteRow } from './note-row';

/** Sidebar: search box on top, then rows grouped by day. Empty state when nothing matches. */
export function NoteList({ notes, selectedId, onSelect, query, onQuery }: { notes: Note[]; selectedId?: string | null; onSelect: (id: string) => void; query: string; onQuery: (q: string) => void }) {
  const groups = groupByDay(filterNotes(notes, query));
  return (
    <div className="flex h-full flex-col">
      <div className="p-3"><SearchInput value={query} onChange={onQuery} /></div>
      <div className="flex-1 overflow-y-auto px-1 pb-3">
        {groups.length === 0 && <EmptyState icon={<FileText />} title={query ? 'No matches' : 'No notes yet'} body={query ? 'Try another word.' : 'Start a session before a call and both sides land here.'} />}
        {groups.map(g => (
          <div key={g.label}>
            <DayHeader label={g.label} />
            {g.notes.map(n => <NoteRow key={n.id} note={n} selected={n.id === selectedId} onSelect={onSelect} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: library-screen.tsx**

```tsx
import type { Bridge, Note } from '@/bridge/types';
import { Wordmark } from '@/shared/brand/wordmark';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Mic, Settings } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NoteList } from './note-list';

/** Two-pane window: 280px sidebar (wordmark, Start button, list) and a content pane. Loads notes over the bridge and re-renders on note.updated. `children` is the content pane. */
export function LibraryScreen({ bridge, selectedId, onSelect, onStart, onSettings, children }: { bridge: Bridge; selectedId: string | null; onSelect: (id: string) => void; onStart: () => void; onSettings: () => void; children?: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    bridge.call('notes.list', undefined).then(n => { if (alive) setNotes(n); });
    const off = bridge.on('note.updated', n => setNotes(prev => prev.some(x => x.id === n.id) ? prev.map(x => x.id === n.id ? { ...n, segments: [] } : x) : [{ ...n, segments: [] }, ...prev]));
    return () => { alive = false; off(); };
  }, [bridge]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr] bg-canvas">
      <aside className="flex flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between px-4 pt-4">
          <Wordmark />
          <Button variant="quiet" size="icon-sm" aria-label="Settings" onClick={onSettings}><Settings /></Button>
        </div>
        <div className="px-3 pt-3"><Button block onClick={onStart}><Mic /> Start notes</Button></div>
        <div className="min-h-0 flex-1"><NoteList notes={notes} selectedId={selectedId} onSelect={onSelect} query={query} onQuery={setQuery} /></div>
      </aside>
      <main className="min-w-0 overflow-y-auto">
        {children ?? <EmptyState icon={<Mic />} title="Pick a note" body="Or start a session before your next call." />}
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Stories**

`note-row.stories.tsx` (`'Library/NoteRow'`): `Ready`, `Processing`, `Failed`, `Selected` from `FIXTURE_NOTES`, in a 280px wide wrapper.
`note-list.stories.tsx` (`'Library/NoteList'`): stateful `render` with `useState` for query and selection; a `Empty` story with `notes: []`.
`library-screen.stories.tsx` (`'Library/LibraryScreen'`): `render: () => { const bridge = useMemo(() => createMockBridge(FIXTURE_NOTES), []); const [sel, setSel] = useState<string|null>(null); return <LibraryScreen bridge={bridge} selectedId={sel} onSelect={setSel} onStart={fn()} onSettings={fn()} />; }` with `parameters: { layout: 'fullscreen' }`. Add an `Empty` story with `createMockBridge([])`.

- [ ] **Step 8: Verify** `npm run check-types && npx vitest run && npm run storybook` (all Library stories render, search filters live, selection highlights).

- [ ] **Step 9: Commit**

```bash
git add web/notes/src/features/library
git commit -m "feat(notes): library model, NoteRow, NoteList and LibraryScreen bricks"
git push
```

---

### Task 1.6: Note detail model and bricks

**Files:**
- Create: `web/notes/src/features/note/model.ts`, `model.test.ts`, `components/note-header.tsx`, `note-header.stories.tsx`, `components/transcript-turn.tsx`, `components/transcript-feed.tsx`, `transcript-feed.stories.tsx`, `components/summary-view.tsx`, `components/note-detail-screen.tsx`, `note-detail-screen.stories.tsx`

**Interfaces:**
- Consumes: `Note`, `Segment`, `Bridge`, `SpeakerChip`, `Tabs`, `Markdown`, `Button`, `IconButton`, `mmss`.
- Produces: `speakerLabel(note: Note, speaker: string): string` ("Me", "Fiona", "Speaker 2"); `renameSpeaker(note: Note, speaker: string, name: string): Note` (pure, returns a new note); `NoteHeader({ note, onTitle(t), onCopy(what), onDelete })`; `TranscriptFeed({ note, onRenameSpeaker(speaker) })`; `SummaryView({ note })` shows `enhanced` if non-empty else `summary` else a hint; `NoteDetailScreen({ bridge, id, onBack })`.

- [ ] **Step 1: model.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { renameSpeaker, speakerLabel } from './model';

describe('note model', () => {
  const note = FIXTURE_NOTES[0]!;
  it('labels speakers', () => {
    expect(speakerLabel(note, 'me')).toBe('Me');
    expect(speakerLabel(note, 's1')).toBe('Fiona');
    expect(speakerLabel(note, 's2')).toBe('Speaker 2');
  });
  it('renames without mutating', () => {
    const out = renameSpeaker(note, 's1', 'Fiona Park');
    expect(out.speakerNames.s1).toBe('Fiona Park');
    expect(note.speakerNames.s1).toBe('Fiona');
  });
  it('trims and ignores empty names', () => {
    expect(renameSpeaker(note, 's1', '   ').speakerNames.s1).toBe('Fiona');
    expect(renameSpeaker(note, 's2', ' Dan ').speakerNames.s2).toBe('Dan');
  });
});
```

- [ ] **Step 2: Run, expect failure. Then model.ts:**

```ts
import type { Note } from '@/bridge/types';

export function speakerLabel(note: Note, speaker: string): string {
  const n = note.speakerNames[speaker];
  if (n) return n;
  if (speaker === 'me') return 'Me';
  return `Speaker ${speaker.replace(/^s/, '')}`;
}

export function renameSpeaker(note: Note, speaker: string, name: string): Note {
  const t = name.trim();
  if (!t) return note;
  return { ...note, speakerNames: { ...note.speakerNames, [speaker]: t } };
}
```

- [ ] **Step 3: Run, expect pass.**

- [ ] **Step 4: Components**

`note-header.tsx`:
```tsx
import type { Note } from '@/bridge/types';
import { Button } from '@/shared/components/ui/button';
import { IconButton } from '@/shared/components/ui/icon-button';
import { mmss } from '@/shared/utils/format';
import { ArrowLeft, Copy, Trash2 } from 'lucide-react';

/** Top of the detail pane: back arrow, editable title (contentEditable-free: an input styled as text), date · duration · attendees, then Copy and Delete on the right. */
export function NoteHeader({ note, onBack, onTitle, onCopy, onDelete }: { note: Note; onBack?: () => void; onTitle: (t: string) => void; onCopy: (what: 'enhanced' | 'transcript' | 'jots') => void; onDelete: () => void }) {
  const date = new Date(note.date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start gap-3 border-b border-line px-6 py-4">
      {onBack && <IconButton label="Back" onClick={onBack}><ArrowLeft /></IconButton>}
      <div className="min-w-0 flex-1">
        <input value={note.title} onChange={e => onTitle(e.target.value)} aria-label="Title"
          className="w-full bg-transparent text-[17px] font-bold text-ink outline-none focus:bg-well rounded-control px-1 -mx-1" />
        <div className="mt-0.5 text-[12px] text-muted tabular-nums">{date}{note.duration > 0 && ` · ${mmss(note.duration)}`}{note.attendees.length > 0 && ` · ${note.attendees.map(a => a.name).join(', ')}`}</div>
      </div>
      <Button variant="soft" size="sm" onClick={() => onCopy(note.enhanced ? 'enhanced' : 'transcript')}><Copy /> Copy</Button>
      <IconButton label="Delete note" onClick={onDelete}><Trash2 /></IconButton>
    </div>
  );
}
```
`transcript-turn.tsx`:
```tsx
import type { Segment } from '@/bridge/types';
import { SpeakerChip } from '@/shared/components/ui/speaker-chip';
import { mmss } from '@/shared/utils/format';

/** One turn: timestamp column (48px, tabular), speaker chip, text. */
export function TranscriptTurn({ segment, name, onRename }: { segment: Segment; name: string; onRename?: () => void }) {
  return (
    <div className="grid grid-cols-[48px_1fr] gap-x-3 py-2">
      <span className="pt-0.5 text-[12px] tabular-nums text-faint">{mmss(segment.start)}</span>
      <div>
        <SpeakerChip speaker={segment.speaker} name={name} onClick={onRename} />
        <p className="mt-1 text-[14px] leading-relaxed text-ink" data-selectable>{segment.text}</p>
      </div>
    </div>
  );
}
```
`transcript-feed.tsx`:
```tsx
import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { MessageSquare } from 'lucide-react';
import { speakerLabel } from '../model';
import { TranscriptTurn } from './transcript-turn';

/** Vertical list of turns. Speaker chips are clickable to rename. Empty state when there are no segments. */
export function TranscriptFeed({ note, onRenameSpeaker }: { note: Note; onRenameSpeaker?: (speaker: string) => void }) {
  if (note.segments.length === 0) return <EmptyState icon={<MessageSquare />} title="No transcript" body={note.status === 'processing' ? 'Still transcribing.' : 'Nothing was heard in this session.'} />;
  return <div className="divide-y divide-line-soft px-6">{note.segments.map(s => <TranscriptTurn key={s.id} segment={s} name={speakerLabel(note, s.speaker)} onRename={onRenameSpeaker && (() => onRenameSpeaker(s.speaker))} />)}</div>;
}
```
`summary-view.tsx`:
```tsx
import type { Note } from '@/bridge/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Markdown } from '@/shared/components/ui/markdown';
import { Sparkles } from 'lucide-react';

/** Shows `enhanced` if present, else `summary`, else a hint. Error banner on top when `note.error` is set. */
export function SummaryView({ note }: { note: Note }) {
  const text = note.enhanced || note.summary;
  return (
    <div className="px-6 py-4">
      {note.error && <div className="mb-4 rounded-card bg-warn-soft px-3 py-2 text-[13px] text-warn">{note.error}</div>}
      {text ? <Markdown source={text} /> : <EmptyState icon={<Sparkles />} title="No notes yet" body={note.status === 'processing' ? 'Writing them now.' : 'Add a Claude key or turn on Apple Intelligence in Settings to get notes.'} />}
    </div>
  );
}
```
`note-detail-screen.tsx`:
```tsx
import type { Bridge, Note } from '@/bridge/types';
import { Tabs } from '@/shared/components/ui/tabs';
import { useEffect, useState } from 'react';
import { renameSpeaker } from '../model';
import { NoteHeader } from './note-header';
import { SummaryView } from './summary-view';
import { TranscriptFeed } from './transcript-feed';

const TABS = [{ id: 'notes', label: 'Notes' }, { id: 'transcript', label: 'Transcript' }, { id: 'jots', label: 'Jots' }];

/** Content pane for one note: header, Notes / Transcript / Jots tabs. Loads via notes.get, follows note.updated, writes edits with notes.update. Speaker rename uses window.prompt for now. */
export function NoteDetailScreen({ bridge, id, onBack, onDeleted }: { bridge: Bridge; id: string; onBack?: () => void; onDeleted: () => void }) {
  const [note, setNote] = useState<Note | null>(null);
  const [tab, setTab] = useState('notes');

  useEffect(() => {
    let alive = true;
    setNote(null);
    bridge.call('notes.get', { id }).then(n => { if (alive) setNote(n); });
    const off = bridge.on('note.updated', n => { if (n.id === id) setNote(n); });
    return () => { alive = false; off(); };
  }, [bridge, id]);

  if (!note) return null;
  const patch = (p: Partial<Note>) => { setNote({ ...note, ...p }); void bridge.call('notes.update', { id, patch: p }); };

  return (
    <div className="flex h-full flex-col">
      <NoteHeader note={note} onBack={onBack} onTitle={t => patch({ title: t })} onCopy={what => void bridge.call('export.copy', { id, what })} onDelete={() => { void bridge.call('notes.delete', { id }).then(onDeleted); }} />
      <div className="px-6 pt-3"><Tabs items={TABS} value={tab} onChange={setTab} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'notes' && <SummaryView note={note} />}
        {tab === 'transcript' && <TranscriptFeed note={note} onRenameSpeaker={s => { const name = window.prompt('Name for this speaker', note.speakerNames[s] ?? ''); if (name != null) patch({ speakerNames: renameSpeaker(note, s, name).speakerNames }); }} />}
        {tab === 'jots' && <pre className="whitespace-pre-wrap px-6 py-4 font-sans text-[14px] text-ink" data-selectable>{note.jots || 'No jots for this session.'}</pre>}
      </div>
    </div>
  );
}
```
`window.prompt` is a stopgap: plan 2 replaces it with an inline popover. It is fine inside WKWebView (the Swift side must implement `runJavaScriptTextInputPanelWithPrompt`, done in Task 2.2).

- [ ] **Step 5: Stories**

`note-header.stories.tsx` (`'Note/NoteHeader'`): `Default` with `FIXTURE_NOTES[0]`, `NoAttendees` with `FIXTURE_NOTES[2]`.
`transcript-feed.stories.tsx` (`'Note/TranscriptFeed'`): `Default`, `Empty` (`FIXTURE_NOTES[1]`).
`note-detail-screen.stories.tsx` (`'Note/NoteDetailScreen'`): `Ready`, `Processing`, `Failed` each with `createMockBridge(FIXTURE_NOTES)` and the matching id, `layout: 'fullscreen'`, wrapped in a `h-[640px]` div.

- [ ] **Step 6: Verify** `npm run check-types && npx vitest run && npm run storybook`. Renaming a speaker in the story (prompt) updates the chips.

- [ ] **Step 7: Commit**

```bash
git add web/notes/src/features/note
git commit -m "feat(notes): note detail model and bricks (header, transcript, summary, screen)"
git push
```

---

## Phase 2: bridge + window in Swift, real data

### Task 2.1: Extend `Note` in Store.swift with defaults-safe decoding

**Files:**
- Modify: `Sources/VoicePet/Store.swift:23-47`

**Interfaces:**
- Produces: `Note.jots: String`, `Note.enhanced: String`, `Note.template: String`, `Note.attendees: [Attendee]`, `Note.calendarEventID: String?`; `struct Attendee: Codable, Equatable { var name: String; var email: String? }`.

- [ ] **Step 1: Replace the `Note` struct**

```swift
struct Attendee: Codable, Equatable {
    var name: String
    var email: String? = nil
}

struct Note: Codable, Identifiable, Equatable {
    var id = UUID()
    var date = Date()
    var title: String = "Untitled"
    var duration: Double = 0
    var summary: String = ""
    var segments: [Segment] = []
    var speakerNames: [String: String] = ["me": "Me"]
    var status: String = "recording"   // recording | processing | ready | failed | enhancing
    var error: String? = nil
    // Ribbit additions. Old notes.json files lack these keys, hence the custom decoder.
    var jots: String = ""
    var enhanced: String = ""
    var template: String = "default"
    var attendees: [Attendee] = []
    var calendarEventID: String? = nil

    init() {}

    enum CodingKeys: String, CodingKey { case id, date, title, duration, summary, segments, speakerNames, status, error, jots, enhanced, template, attendees, calendarEventID }

    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        date = try c.decode(Date.self, forKey: .date)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        duration = try c.decodeIfPresent(Double.self, forKey: .duration) ?? 0
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        segments = try c.decodeIfPresent([Segment].self, forKey: .segments) ?? []
        speakerNames = try c.decodeIfPresent([String: String].self, forKey: .speakerNames) ?? ["me": "Me"]
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "ready"
        error = try c.decodeIfPresent(String.self, forKey: .error)
        jots = try c.decodeIfPresent(String.self, forKey: .jots) ?? ""
        enhanced = try c.decodeIfPresent(String.self, forKey: .enhanced) ?? ""
        template = try c.decodeIfPresent(String.self, forKey: .template) ?? "default"
        attendees = try c.decodeIfPresent([Attendee].self, forKey: .attendees) ?? []
        calendarEventID = try c.decodeIfPresent(String.self, forKey: .calendarEventID)
    }

    func name(for speaker: String) -> String {
        if let n = speakerNames[speaker] { return n }
        if speaker == "me" { return "Me" }
        return "Speaker " + speaker.dropFirst()
    }
}
```
Keep the existing `name(for:)` body if it differs; the one above matches the current behaviour (check `Store.swift:42-47` before replacing).

- [ ] **Step 2: Build**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer && swift build -c release 2>&1 | grep -E "error|Compiling|Build complete" | tail -5
```
Expected: `Build complete!`.

- [ ] **Step 3: Verify old notes still load**

```bash
./build.sh && open build/VoicePet.app --args --hub
```
Notes from Task 0.1 still show in the SwiftUI Notes tab. Quit the app.

- [ ] **Step 4: Commit**

```bash
git add Sources/VoicePet/Store.swift
git commit -m "feat(store): jots, enhanced, template, attendees on Note with defaults-safe decoding"
git push
```

---

### Task 2.2: Bridge.swift and NotesWindow.swift

**Files:**
- Create: `Sources/VoicePet/Bridge.swift`, `Sources/VoicePet/NotesWindow.swift`
- Modify: `Sources/VoicePet/AppDelegate.swift:9-10` (add `lazy var notesWindow`), `:70` (add `--notes` flag), `Sources/VoicePet/StatusBar.swift:25` (add menu item), `build.sh`

**Interfaces:**
- Consumes: `Store.shared.notes/upsert/delete`, `MeetingRecorder.start/stop/isRecording/isProcessing/elapsed/currentNoteID`, `Summarizer.hasClaudeKey`, `NoteProcessor.transcriptText`.
- Produces: `final class Bridge: NSObject, WKScriptMessageHandler` with `func send(event: String, payload: Encodable)`; `final class NotesWindow` with `show()`, `hide()`, `isVisible`, `bridge: Bridge`. Commands implemented in this task: `notes.list`, `notes.get`, `notes.update`, `notes.delete`, `session.start`, `session.stop`, `session.status`, `export.copy`, `settings.get`, `settings.set` (speech/summary engines + showFrog only), `window.close`. `calendar.*`, `enhance.run`, `chat.ask` reply with error `"not implemented"` until plan 2.

- [ ] **Step 1: Bridge.swift**

```swift
import AppKit
import WebKit

/// JSON message bridge between web/notes and the engine. Wire format mirrors web/notes/src/bridge/types.ts.
/// Up:   window.webkit.messageHandlers.ribbit.postMessage({id, type, payload})
/// Down: ribbit.receive({id, ok, payload, error}) for replies, ribbit.receive({type, payload}) for events.
@MainActor
final class Bridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private weak var app: AppDelegate?
    private var tickTimer: Timer?

    static let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    static let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    init(app: AppDelegate) { self.app = app; super.init() }

    // MARK: WKScriptMessageHandler
    nonisolated func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let id = body["id"] as? String, let type = body["type"] as? String else { return }
        let payload = body["payload"]
        Task { @MainActor in
            do {
                let reply = try await self.handle(type: type, payload: payload)
                self.emit(["id": id, "ok": true, "payload": reply])
            } catch {
                self.emit(["id": id, "ok": false, "error": error.localizedDescription])
            }
        }
    }

    // MARK: events
    func send<T: Encodable>(event: String, payload: T) {
        guard let data = try? Self.encoder.encode(payload), let json = String(data: data, encoding: .utf8) else { return }
        js("ribbit.receive({type: \(Self.quote(event)), payload: \(json)})")
    }

    private func emit(_ dict: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(dict), let data = try? JSONSerialization.data(withJSONObject: dict), let json = String(data: data, encoding: .utf8) else { return }
        js("ribbit.receive(\(json))")
    }

    private func js(_ script: String) { webView?.evaluateJavaScript(script, completionHandler: nil) }
    private static func quote(_ s: String) -> String { String(data: try! JSONSerialization.data(withJSONObject: [s]), encoding: .utf8)!.dropFirst().dropLast().description }

    // MARK: dispatch
    private func handle(type: String, payload: Any?) async throws -> Any {
        guard let app else { throw BridgeError.gone }
        switch type {
        case "notes.list":
            return try jsonArray(Store.shared.notes.map { var n = $0; n.segments = []; return n })
        case "notes.get":
            return try json(try find(payload))
        case "notes.update":
            var note = try find(payload)
            let patch = (payload as? [String: Any])?["patch"] as? [String: Any] ?? [:]
            if let v = patch["title"] as? String { note.title = v }
            if let v = patch["jots"] as? String { note.jots = v }
            if let v = patch["enhanced"] as? String { note.enhanced = v }
            if let v = patch["template"] as? String { note.template = v }
            if let v = patch["speakerNames"] as? [String: String] { note.speakerNames = v }
            if let v = patch["attendees"] as? [[String: Any]] { note.attendees = v.compactMap { d in (d["name"] as? String).map { Attendee(name: $0, email: d["email"] as? String) } } }
            Store.shared.upsert(note)
            send(event: "note.updated", payload: note)
            return try json(note)
        case "notes.delete":
            Store.shared.delete(try find(payload))
            return "ok"
        case "session.start":
            let p = payload as? [String: Any]
            app.meeting.start()
            guard let id = app.meeting.currentNoteID, var note = Store.shared.notes.first(where: { $0.id == id }) else { throw BridgeError.message("Could not start (dictation active or already recording)") }
            if let t = p?["title"] as? String, !t.isEmpty { note.title = t }
            if let e = p?["calendarEventID"] as? String { note.calendarEventID = e }
            Store.shared.upsert(note)
            startTicks()
            return ["noteId": id.uuidString]
        case "session.stop":
            app.meeting.stop()
            stopTicks()
            return "ok"
        case "session.status":
            return ["recording": app.meeting.isRecording, "processing": app.meeting.isProcessing, "noteId": app.meeting.currentNoteID?.uuidString as Any, "elapsed": app.meeting.elapsed]
        case "export.copy":
            let note = try find(payload)
            let what = (payload as? [String: Any])?["what"] as? String ?? "enhanced"
            let text = what == "transcript" ? NoteProcessor.transcriptText(note) : what == "jots" ? note.jots : (note.enhanced.isEmpty ? note.summary : note.enhanced)
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
            return "ok"
        case "settings.get":
            return settingsDict()
        case "settings.set":
            let p = payload as? [String: Any] ?? [:]
            if let v = p["speechEngine"] as? String { app.selectEngine(v) }
            if let v = p["summaryEngine"] as? String { UserDefaults.standard.set(v, forKey: "summaryEngine") }
            if let v = p["showFrog"] as? Bool { v ? app.panel.orderFront(nil) : app.panel.orderOut(nil) }
            return settingsDict()
        case "window.close":
            app.notesWindow.hide()
            return "ok"
        case "calendar.upcoming", "calendar.authorize", "enhance.run", "chat.ask":
            throw BridgeError.message("\(type) is not implemented yet")
        default:
            NSLog("bridge: unknown command \(type)")
            throw BridgeError.message("Unknown command \(type)")
        }
    }

    private func settingsDict() -> [String: Any] {
        ["speechEngine": UserDefaults.standard.string(forKey: "engine") ?? "apple",
         "summaryEngine": UserDefaults.standard.string(forKey: "summaryEngine") ?? "claude",
         "hasClaudeKey": Summarizer.hasClaudeKey,
         "calendarEnabled": false,
         "callDetection": [String: Bool](),
         "showFrog": app?.panel.isVisible ?? true]
    }

    private func find(_ payload: Any?) throws -> Note {
        guard let s = (payload as? [String: Any])?["id"] as? String, let id = UUID(uuidString: s), let n = Store.shared.notes.first(where: { $0.id == id }) else { throw BridgeError.message("note not found") }
        return n
    }

    // MARK: ticks while recording
    private func startTicks() {
        stopTicks()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let app = self.app, app.meeting.isRecording, let id = app.meeting.currentNoteID else { self?.stopTicks(); return }
                self.emit(["type": "session.tick", "payload": ["noteId": id.uuidString, "elapsed": app.meeting.elapsed, "level": Double(app.recorder.level)]])
            }
        }
    }
    private func stopTicks() { tickTimer?.invalidate(); tickTimer = nil }

    // MARK: JSON helpers (Encodable -> Foundation object, so it can sit inside the reply dict)
    private func json<T: Encodable>(_ v: T) throws -> Any { try JSONSerialization.jsonObject(with: Self.encoder.encode(v)) }
    private func jsonArray<T: Encodable>(_ v: [T]) throws -> Any { try JSONSerialization.jsonObject(with: Self.encoder.encode(v)) }

    enum BridgeError: LocalizedError {
        case gone, message(String)
        var errorDescription: String? { switch self { case .gone: return "app is gone"; case .message(let m): return m } }
    }
}
```
Check that `UserDefaults` key for the speech engine really is `"engine"`: `grep -n 'forKey: "engine' Sources/VoicePet/AppDelegate.swift`. Use whatever key `selectEngine` writes. Check `app.recorder` is the `AudioRecorder` property name in AppDelegate (`grep -n "recorder" Sources/VoicePet/AppDelegate.swift`); if it is private, make it `let recorder` (internal).

- [ ] **Step 2: NotesWindow.swift**

```swift
import AppKit
import WebKit

/// The Ribbit notes window: a normal resizable window hosting web/notes over the bridge.
@MainActor
final class NotesWindow: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    let bridge: Bridge
    private let window: NSWindow
    private let webView: WKWebView
    private weak var app: AppDelegate?

    init(app: AppDelegate) {
        self.app = app
        bridge = Bridge(app: app)
        let cfg = WKWebViewConfiguration()
        cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")
        cfg.userContentController.add(bridge, name: "ribbit")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 960, height: 640), configuration: cfg)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 640), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        super.init()
        bridge.webView = webView
        window.title = "Ribbit Notes"
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 720, height: 480)
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.delegate = self
        window.setFrameAutosaveName("RibbitNotes")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "notes") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            NSLog("notes/index.html missing from bundle")
        }
    }

    var isVisible: Bool { window.isVisible }
    func show() { NSApp.activate(ignoringOtherApps: true); window.center(); if window.frameAutosaveName.isEmpty == false { window.setFrameUsingName("RibbitNotes") }; window.makeKeyAndOrderFront(nil) }
    func hide() { window.orderOut(nil) }

    // window.prompt() support for the speaker rename stopgap.
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert(); alert.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 240, height: 24)); field.stringValue = defaultText ?? ""
        alert.accessoryView = field; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = field
        completionHandler(alert.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool { hide(); return false }
}
```

- [ ] **Step 3: AppDelegate + StatusBar + main.swift wiring**

In `AppDelegate.swift` after `lazy var hub = HubController(app: self)`:
```swift
    lazy var notesWindow = NotesWindow(app: self)
```
Next to the `--hub` line in `applicationDidFinishLaunching`:
```swift
        if CommandLine.arguments.contains("--notes") { DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { self.notesWindow.show() } }
```
Also forward meeting state to the window so the UI updates when processing finishes. Inside the existing `meeting.onStateChange = { [weak self] s in ... }` closure add:
```swift
            if s == "done" || s == "idle", let id = self?.meeting.currentNoteID ?? Store.shared.notes.first?.id, let n = Store.shared.notes.first(where: { $0.id == id }) { self?.notesWindow.bridge.send(event: "note.updated", payload: n) }
```
Check what states `MeetingRecorder` emits (`grep -n "onStateChange?" Sources/VoicePet/Meeting.swift`) and match them; the goal is one `note.updated` after processing ends and one when it starts (`"noting"`).

In `StatusBar.swift` after the "Notes & settings…" item:
```swift
        menu.addItem(make("Ribbit notes window", #selector(openNotes), key: "n"))
```
and the selector:
```swift
    @objc private func openNotes() { app?.notesWindow.show() }
```

- [ ] **Step 4: build.sh**

After the line `(cd web && npm run build --silent)` add:
```bash
(cd web/notes && npm run build --silent)
```
After `cp -R web/dist/. "$APP/Contents/Resources/web/"` add:
```bash
mkdir -p "$APP/Contents/Resources/notes" && cp web/notes/dist/index.html "$APP/Contents/Resources/notes/"
```

- [ ] **Step 5: Build and open**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer && ./build.sh && open build/VoicePet.app --args --notes
```
Expected: a 960×640 window titled "Ribbit Notes" showing the placeholder "Ribbit Notes" text from Task 1.1 (App.tsx is still the placeholder). Right-click the WebView → Inspect Element works (developer extras).

- [ ] **Step 6: Commit**

```bash
git add Sources/VoicePet/Bridge.swift Sources/VoicePet/NotesWindow.swift Sources/VoicePet/AppDelegate.swift Sources/VoicePet/StatusBar.swift build.sh
git commit -m "feat(bridge): JSON bridge and Ribbit notes window hosting web/notes"
git push
```

---

### Task 2.3: WK transport in TypeScript

**Files:**
- Create: `web/notes/src/bridge/wk.ts`, `web/notes/src/bridge/wk.test.ts`

**Interfaces:**
- Produces: `createWKBridge(): Bridge`. Installs `window.ribbit = { receive(msg) }`. If `window.webkit.messageHandlers.ribbit` is missing (plain browser), `call` rejects with `"no native bridge"`.

- [ ] **Step 1: wk.test.ts**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWKBridge } from './wk';

declare global { interface Window { webkit?: { messageHandlers: { ribbit: { postMessage: (m: unknown) => void } } }; ribbit?: { receive: (m: unknown) => void } } }

describe('createWKBridge', () => {
  beforeEach(() => { delete window.webkit; delete window.ribbit; });

  it('rejects without a native handler', async () => {
    const b = createWKBridge();
    await expect(b.call('notes.list', undefined)).rejects.toThrow('no native bridge');
  });

  it('posts a command and resolves on the matching reply', async () => {
    const post = vi.fn();
    window.webkit = { messageHandlers: { ribbit: { postMessage: post } } };
    const b = createWKBridge();
    const p = b.call('notes.get', { id: 'x' });
    const sent = post.mock.calls[0]![0] as { id: string; type: string; payload: unknown };
    expect(sent.type).toBe('notes.get');
    window.ribbit!.receive({ id: sent.id, ok: true, payload: { id: 'x', title: 'T' } });
    await expect(p).resolves.toMatchObject({ title: 'T' });
  });

  it('rejects on error replies and routes events', async () => {
    const post = vi.fn();
    window.webkit = { messageHandlers: { ribbit: { postMessage: post } } };
    const b = createWKBridge();
    const p = b.call('notes.get', { id: 'x' });
    const sent = post.mock.calls[0]![0] as { id: string };
    window.ribbit!.receive({ id: sent.id, ok: false, error: 'note not found' });
    await expect(p).rejects.toThrow('note not found');
    const h = vi.fn();
    b.on('error', h);
    window.ribbit!.receive({ type: 'error', payload: { message: 'boom' } });
    expect(h).toHaveBeenCalledWith({ message: 'boom' });
  });
});
```

- [ ] **Step 2: Run, expect failure. Then wk.ts:**

```ts
import type { Bridge, EventType, WireCommand, WireEvent, WireReply } from './types';

/** Production transport: WKWebView message handler up, `ribbit.receive` down. See Sources/VoicePet/Bridge.swift. */
export function createWKBridge(): Bridge {
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const handlers = new Map<EventType, Set<(p: unknown) => void>>();
  let seq = 0;

  window.ribbit = {
    receive(msg: unknown) {
      const m = msg as Partial<WireReply & WireEvent>;
      if (typeof m.id === 'string') {
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        m.ok ? p.resolve(m.payload) : p.reject(new Error(m.error ?? 'bridge error'));
      } else if (typeof m.type === 'string') {
        handlers.get(m.type as EventType)?.forEach(h => h(m.payload));
      }
    },
  };

  return {
    call(type, payload) {
      const native = window.webkit?.messageHandlers?.ribbit;
      if (!native) return Promise.reject(new Error('no native bridge'));
      const id = `c${++seq}`;
      const msg: WireCommand = { id, type, payload };
      return new Promise((resolve, reject) => { pending.set(id, { resolve: resolve as (v: unknown) => void, reject }); native.postMessage(msg); });
    },
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as (p: unknown) => void);
      return () => { handlers.get(type)?.delete(handler as (p: unknown) => void); };
    },
  };
}
```
Add the `declare global` block from the test to a `src/bridge/global.d.ts` so `window.webkit` and `window.ribbit` type-check in app code too.

- [ ] **Step 3: Run, expect 3 passed. Commit.**

```bash
git add web/notes/src/bridge
git commit -m "feat(notes): WKWebView bridge transport"
git push
```

---

### Task 2.4: App shell on the real bridge, remove SwiftUI notes

**Files:**
- Modify: `web/notes/src/App.tsx`, `web/notes/src/main.tsx`
- Create: `web/notes/src/features/settings/components/settings-screen.tsx`, `settings-screen.stories.tsx`
- Modify: `Sources/VoicePet/Hub.swift` (delete `NotesView`, `Pulse`, `NoteRow`, `NoteDetail`, `NotesText`; replace `case 0: NotesView()` with a launcher)

**Interfaces:**
- Consumes: `LibraryScreen`, `NoteDetailScreen`, `createWKBridge`, `Bridge`, `Settings`.
- Produces: `App({ bridge })`; `SettingsScreen({ bridge, onBack })` with speech engine and summary engine segmented choices, "Show the frog" toggle, and a read-only line "Claude key: set / not set (change it in the frog's Me tab)".

- [ ] **Step 1: App.tsx**

```tsx
import type { Bridge } from '@/bridge/types';
import { LibraryScreen } from '@/features/library/components/library-screen';
import { NoteDetailScreen } from '@/features/note/components/note-detail-screen';
import { SettingsScreen } from '@/features/settings/components/settings-screen';
import { useEffect, useState } from 'react';

type Route = { name: 'library' } | { name: 'settings' };

/** Window root. Sidebar is always the library; the content pane is a note, the settings screen, or the empty hint. */
export function App({ bridge }: { bridge: Bridge }) {
  const [route, setRoute] = useState<Route>({ name: 'library' });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => bridge.on('error', e => setError(e.message)), [bridge]);

  const start = async () => {
    try { const { noteId } = await bridge.call('session.start', {}); setSelected(noteId); setRoute({ name: 'library' }); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <LibraryScreen bridge={bridge} selectedId={selected} onSelect={id => { setSelected(id); setRoute({ name: 'library' }); }} onStart={start} onSettings={() => setRoute({ name: 'settings' })}>
        {route.name === 'settings' ? <SettingsScreen bridge={bridge} onBack={() => setRoute({ name: 'library' })} />
          : selected ? <NoteDetailScreen bridge={bridge} id={selected} onDeleted={() => setSelected(null)} /> : undefined}
      </LibraryScreen>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-card bg-ink px-4 py-2 text-[13px] text-white shadow-lg" onClick={() => setError(null)}>{error}</div>
      )}
    </>
  );
}
```
`main.tsx` passes `bridge={createWKBridge()}` (import from `@/bridge/wk`).

- [ ] **Step 2: settings-screen.tsx**

```tsx
import type { Bridge, Settings } from '@/bridge/types';
import { IconButton } from '@/shared/components/ui/icon-button';
import { cn } from '@/shared/utils/ui-utils';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-control bg-line-soft p-0.5">
      {options.map(o => <button key={o.id} type="button" onClick={() => onChange(o.id)} className={cn('rounded-[6px] px-3 py-1 text-[13px] font-semibold', o.id === value ? 'bg-surface text-ink shadow-sm' : 'text-muted')}>{o.label}</button>)}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line-soft py-3">
      <div><div className="text-[14px] font-semibold text-ink">{label}</div>{hint && <div className="text-[12px] text-muted">{hint}</div>}</div>
      {children}
    </div>
  );
}

/** Settings pane: speech engine, summary engine, Claude key status (read-only here), show-the-frog toggle. Reads settings.get, writes settings.set per change. */
export function SettingsScreen({ bridge, onBack }: { bridge: Bridge; onBack: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { bridge.call('settings.get', undefined).then(setS); }, [bridge]);
  if (!s) return null;
  const set = (patch: Partial<Settings>) => bridge.call('settings.set', patch).then(setS);
  return (
    <div className="mx-auto max-w-xl px-6 py-4">
      <div className="mb-4 flex items-center gap-2"><IconButton label="Back" onClick={onBack}><ArrowLeft /></IconButton><h1 className="text-[17px] font-bold">Settings</h1></div>
      <Row label="Speech engine" hint="Apple is instant; Parakeet is more accurate on names."><Segmented value={s.speechEngine} options={[{ id: 'apple', label: 'Apple' }, { id: 'parakeet', label: 'Parakeet' }]} onChange={v => set({ speechEngine: v })} /></Row>
      <Row label="Notes writer" hint={s.hasClaudeKey ? 'Claude key is set.' : 'No Claude key. Add one in the frog\'s Me tab, or use Apple Intelligence.'}><Segmented value={s.summaryEngine} options={[{ id: 'claude', label: 'Claude' }, { id: 'apple', label: 'Apple' }]} onChange={v => set({ summaryEngine: v })} /></Row>
      <Row label="Show the frog"><input type="checkbox" checked={s.showFrog} onChange={e => set({ showFrog: e.target.checked })} /></Row>
    </div>
  );
}
```
Story `'Settings/SettingsScreen'` with `createMockBridge([])`.

- [ ] **Step 3: Hub.swift launcher**

Delete `struct NotesView`, `struct Pulse`, `struct NoteRow`, `struct NoteDetail`, `struct NotesText` (currently `Hub.swift:190-495`; confirm the range with `grep -n "^struct\|^// MARK" Sources/VoicePet/Hub.swift`). Replace `case 0: NotesView()` with `case 0: NotesLaunchView(onOpen: { [weak app] in app?.notesWindow.show() })` and pass `app` into `HubView` the same way `onEngineChange` is passed (add `var onOpenNotes: () -> Void` to `HubView`, set it in `HubController.init`). Add:
```swift
struct NotesLaunchView: View {
    var onOpen: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "note.text").font(.system(size: 28, weight: .bold)).foregroundStyle(Color.petAccent)
            Text("Notes live in their own window now.").font(.system(size: 14, weight: .semibold, design: .rounded))
            Button("Open Ribbit notes") { onOpen() }.buttonStyle(Pill(filled: true))
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```
If anything else in Hub.swift referenced the deleted views (`mmss`, `Pill`, `Card`), keep those helpers; only delete the five structs.

- [ ] **Step 4: Build, run, exercise**

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer && (cd web/notes && npm run check-types && npx vitest run) && ./build.sh && open build/VoicePet.app --args --notes
```
Checklist in the window:
1. The note from Task 0.1 appears in the sidebar with its title and duration.
2. Clicking it shows the summary under Notes and the turns under Transcript.
3. Renaming a speaker via the prompt updates the chip and survives an app restart.
4. Editing the title persists.
5. Copy puts the summary on the clipboard (paste into TextEdit).
6. Start notes → row appears with the Recording pill → Stop (there is no Stop button yet in the UI; use the frog's Notes tab or the menu) → row goes Processing → Ready and the transcript fills in.
7. Settings → switching Notes writer to Apple persists (reopen Settings).
8. The frog's Notes tab shows the launcher and opens the window.

- [ ] **Step 5: Commit**

```bash
git add web/notes/src Sources/VoicePet/Hub.swift
git commit -m "feat(notes): app shell on the real bridge, settings screen, SwiftUI notes replaced by launcher"
git push
```

---

### Task 2.5: Stop from the UI and the recording banner

**Files:**
- Create: `web/notes/src/features/session/components/session-bar.tsx`, `session-bar.stories.tsx`
- Modify: `web/notes/src/App.tsx`, `web/notes/src/features/library/components/library-screen.tsx`

**Interfaces:**
- Produces: `SessionBar({ elapsed: number; level: number; title: string; onStop })`: full-width red-tinted bar with a pulsing dot, title, `mmss(elapsed)`, a 5-segment level meter and a Stop button. `LibraryScreen` gains an optional `banner?: ReactNode` rendered above the content pane.

- [ ] **Step 1: session-bar.tsx**

```tsx
import { Button } from '@/shared/components/ui/button';
import { mmss } from '@/shared/utils/format';
import { cn } from '@/shared/utils/ui-utils';
import { Square } from 'lucide-react';

/** Recording banner: pulsing red dot, note title, elapsed mm:ss, 5-bar mic level, Stop. Sits above the content pane while a session runs. */
export function SessionBar({ elapsed, level, title, onStop }: { elapsed: number; level: number; title: string; onStop: () => void }) {
  const bars = Math.round(Math.min(1, Math.max(0, level)) * 5);
  return (
    <div className="flex items-center gap-3 border-b border-rec-soft bg-rec-soft/60 px-6 py-2">
      <span className="size-2.5 animate-pulse rounded-full bg-rec" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{title}</span>
      <span className="flex items-end gap-0.5" aria-hidden>{[1, 2, 3, 4, 5].map(i => <span key={i} className={cn('w-1 rounded-sm', i <= bars ? 'bg-rec' : 'bg-line')} style={{ height: 4 + i * 2 }} />)}</span>
      <span className="text-[13px] tabular-nums text-body">{mmss(elapsed)}</span>
      <Button variant="ghost" size="sm" onClick={onStop}><Square /> Stop</Button>
    </div>
  );
}
```
Story `'Session/SessionBar'`: `Default` (elapsed 754, level 0.6), `Quiet` (level 0).

- [ ] **Step 2: Wire into App.tsx**

Add state `session: { noteId: string; elapsed: number; level: number; title: string } | null`. On mount call `session.status`; if recording, set it (title from `notes.get`). Subscribe to `session.tick` to update `elapsed`/`level`, and to `note.updated` to clear the session when that note's status is no longer `recording`. `start()` sets the session from the reply. Pass `banner={session && <SessionBar ... onStop={() => bridge.call('session.stop', undefined)} />}` to `LibraryScreen`, and render `banner` in `LibraryScreen` above `{children}` inside `<main>`.

- [ ] **Step 3: Build and test**

Start from the window, watch elapsed count and the meter move while talking, Stop from the bar, row goes Processing → Ready.

- [ ] **Step 4: Commit**

```bash
git add web/notes/src
git commit -m "feat(notes): session bar with live elapsed, level and Stop"
git push
```

---

### Task 2.6: Docs and phase wrap-up

**Files:**
- Modify: `README.md` (add a "Ribbit" section on top: what changed vs Frog, how to open the notes window, `--notes` flag, `web/notes` dev commands), `CLAUDE.md` (add `web/notes` layout, bridge file pair, the `DEVELOPER_DIR` requirement, story conventions)

- [ ] **Step 1: README section**

```markdown
## Ribbit (this fork)

Ribbit adds a Granola-style notes window on top of Frog. The engine is Frog's; the UI is React + Storybook in `web/notes`, hosted in a native window and talking to Swift over a JSON bridge (`Sources/VoicePet/Bridge.swift` ⇄ `web/notes/src/bridge/`).

Open it from the menu bar (Ribbit notes window, ⌘N) or launch with `--notes`.

Develop the UI without the app:

    cd web/notes && npm install
    npm run storybook      # bricks on :6007, mock bridge
    npm run dev            # the window in a browser on :5211 (no native bridge; use stories for data)
    npm test               # models and transports

Build the app: `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer && ./build.sh`. The default Command Line Tools ship an older Swift than `Package.swift` requires.
```

- [ ] **Step 2: CLAUDE.md additions** under "Swift side":

```markdown
- `NotesWindow` + `Bridge` host `web/notes` (React). Commands and events are typed once in `web/notes/src/bridge/types.ts`; `Bridge.swift` must handle every command listed there. Add a command by editing both, then `createMockBridge` in `mock.ts` so stories keep working.
- Every visual piece in `web/notes` is a Storybook brick (props in, callbacks out). Screens take a `Bridge`. Conventions: CSF3, `satisfies Meta`, `title: 'Shared/UI/X'` or `'<Feature>/X'`, `docs.description.component` describing the layout.
- Build with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
```

- [ ] **Step 3: Commit and open the PR**

```bash
git add README.md CLAUDE.md
git commit -m "docs: Ribbit notes window, web/notes workflow, bridge conventions"
git push
gh pr create --title "feat: Ribbit notes window (phases 0-2)" --body "React + Storybook notes UI hosted in a native window over a JSON bridge. Library, note detail, settings, session bar. Spec: docs/superpowers/specs/2026-09-14-granola-notes-ui-design.md

https://claude.ai/code/session_018tEz5ixahNQVj1tCGkkwZn"
```
Personal repo: after the checklist in Task 2.4 passes, merge fast-forward (`git checkout main && git merge --ff-only feat/notes-ui && git push`) from the main clone, not the worktree, then continue plan 2 on a new branch `feat/notes-session`.

---

## Self-review notes

- Spec coverage for phases 0-2: library (list, search, rename, copy, delete), detail tabs, settings (engines, frog toggle), bridge commands `notes.*`, `session.*`, `export.copy`, `settings.*`, `window.close`, events `session.tick`, `note.updated`, `error`. `calendar.*`, `enhance.run`, `chat.ask`, `transcript.segment`, `call.detected`, templates, jots editing, chat, calendar are plan 2.
- Type names used across tasks: `Note`, `Segment`, `Attendee`, `Bridge`, `MockBridge`, `createMockBridge`, `createWKBridge`, `FIXTURE_NOTES`, `mmss`, `dayLabel`, `initials`, `speakerTone`, `speakerLabel`, `renameSpeaker`, `filterNotes`, `groupByDay`, `LibraryScreen`, `NoteDetailScreen`, `SettingsScreen`, `SessionBar`. Swift: `Bridge`, `NotesWindow`, `Attendee`, `Note.jots/enhanced/template/attendees/calendarEventID`, `AppDelegate.notesWindow`.
- Known stopgap: `window.prompt` for speaker rename (replaced in plan 2, Task 3.5).
