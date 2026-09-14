# Ribbit Notes Session, Calendar and Chat Implementation Plan (phases 3-6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the notes window from a viewer into Granola's workflow: jot during the call with a live transcript, enhance jots with the transcript after, get prompted when a meeting starts, name speakers from the calendar, chat with a note, and ship a signed build.

**Architecture:** Builds on the foundation plan (bridge, window, library, detail). New Swift units hook into the existing recorder without changing it: `LiveTranscriber` observes the mic/tap sample streams, `Enhancer` reuses `Summarizer`'s Claude/Apple calls with a different prompt, `CalendarSource` wraps EventKit, `CallDetector` polls Core Audio and running apps. New web features: `session`, `enhance`, `calendar`, plus an inline rename popover.

**Tech Stack:** as the foundation plan, plus EventKit, CoreAudio device properties, Apple Foundation Models (already a dependency via Summarizer).

**Spec:** `docs/superpowers/specs/2026-09-14-granola-notes-ui-design.md`

## Global Constraints

- Everything in the foundation plan's Global Constraints.
- Nothing records without the user pressing Start or accepting a prompt.
- Live segments are provisional; the final pass on Stop replaces them.
- Templates are markdown files under `~/Library/Application Support/VoicePet/templates/`; the four defaults are written on first launch if the folder is empty and never overwritten after.
- New permission strings go in `Resources/Info.plist`: `NSCalendarsFullAccessUsageDescription`.
- Branch `feat/notes-session` in a fresh worktree `~/Documents/GitHub/ribbit-session` off `main` after the foundation PR is merged.

---

## File structure

```
web/notes/src/
  bridge/types.ts                       Template type; 'templates.list' command; Settings.callDetection keys documented
  bridge/mock.ts                        templates.list, calendar.*, enhance.run, chat.ask answered from fixtures
  fixtures/notes.ts                     FIXTURE_TEMPLATES
  features/session/model.ts             mergeLiveSegment(), jotsAutosave() reducer  (+ test)
  features/session/components/          jot-pad, live-transcript, session-screen (+ stories); session-bar exists
  features/enhance/components/          template-picker, enhanced-notes (replaces summary-view usage), chat-box (+ stories)
  features/note/components/             rename-popover (+ story); note-detail-screen uses it and adds Enhance + Chat
  features/calendar/components/         upcoming-card, call-prompt (+ stories)
  features/settings/components/         settings-screen gains calendar + call detection rows
  App.tsx                               session route, call prompt overlay, upcoming card in sidebar

Sources/VoicePet/
  LiveTranscriber.swift   (new) chunked transcription during a session -> transcript.segment events
  Enhancer.swift          (new) templates on disk + jots+transcript -> enhanced markdown; chat
  CalendarSource.swift    (new) EventKit
  CallDetector.swift      (new) rising-edge detector -> call.detected
  Meeting.swift           MeetingRecorder exposes onMicSamples/onSysSamples taps; runs Enhancer after NoteProcessor
  Bridge.swift            implements calendar.*, enhance.run, chat.ask, templates.list, settings for calendar/callDetection
  AppDelegate.swift       owns CalendarSource + CallDetector; prompt panel
  Resources/Info.plist    calendar usage string
```

---

## Phase 3: session screen, live transcript, enhance

### Task 3.1: Templates and Enhancer in Swift

**Files:**
- Create: `Sources/VoicePet/Enhancer.swift`
- Modify: `Sources/VoicePet/Bridge.swift` (`enhance.run`, `templates.list`), `web/notes/src/bridge/types.ts`, `web/notes/src/bridge/mock.ts`, `web/notes/src/fixtures/notes.ts`

**Interfaces:**
- Produces (Swift): `struct Template: Codable { var id: String; var name: String; var instructions: String }`; `enum Enhancer { static func templates() -> [Template]; static func enhance(note: Note, template: Template) async throws -> String; static func chat(note: Note, question: String) async throws -> String }`.
- Produces (TS): `interface Template { id: string; name: string; instructions: string }`; command `'templates.list': { payload: undefined; reply: Template[] }`; `FIXTURE_TEMPLATES: Template[]`.

- [ ] **Step 1: Enhancer.swift**

```swift
import Foundation
import FoundationModels

struct Template: Codable, Equatable {
    var id: String
    var name: String
    var instructions: String
}

/// Jots + transcript -> enhanced notes, and question + note -> answer. Same engines as Summarizer (Claude if a key is set, else Apple on-device).
enum Enhancer {
    static var dir: URL { Store.shared.dir.appendingPathComponent("templates", isDirectory: true) }

    static let defaults: [Template] = [
        Template(id: "default", name: "Default", instructions: "Expand the user's jots into complete notes using the transcript. Keep the user's structure and wording where they wrote something; fill gaps from the transcript. End with ## Decisions and ## Action items (owner, what, when)."),
        Template(id: "one-to-one", name: "1:1", instructions: "Notes for a one-to-one. Sections: ## Updates, ## Concerns raised, ## Feedback given or received, ## Agreed next steps. Keep it personal and short."),
        Template(id: "customer", name: "Customer call", instructions: "Notes for a customer or sales call. Sections: ## Who they are, ## Pain and current workaround, ## What they asked for, ## Objections, ## Next step and owner."),
        Template(id: "standup", name: "Standup", instructions: "Per person: what they did, what they will do, blockers. One line each. Then ## Blockers to chase."),
    ]

    /// Reads templates from disk; writes the defaults on first run.
    static func templates() -> [Template] {
        let fm = FileManager.default
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let files = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        if files.filter({ $0.pathExtension == "md" }).isEmpty {
            for t in defaults { try? "---\nname: \(t.name)\n---\n\(t.instructions)\n".write(to: dir.appendingPathComponent("\(t.id).md"), atomically: true, encoding: .utf8) }
        }
        let loaded = ((try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []).filter { $0.pathExtension == "md" }.compactMap { url -> Template? in
            guard let text = try? String(contentsOf: url, encoding: .utf8) else { return nil }
            let id = url.deletingPathExtension().lastPathComponent
            var name = id.capitalized, body = text
            if text.hasPrefix("---\n"), let end = text.range(of: "\n---\n") {
                let front = text[text.index(text.startIndex, offsetBy: 4)..<end.lowerBound]
                for line in front.split(separator: "\n") { if line.hasPrefix("name:") { name = line.dropFirst(5).trimmingCharacters(in: .whitespaces) } }
                body = String(text[end.upperBound...])
            }
            return Template(id: id, name: name, instructions: body.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return loaded.sorted { a, b in (a.id == "default" ? 0 : 1, a.name) < (b.id == "default" ? 0 : 1, b.name) }
    }

    static let system = """
    You turn a person's rough meeting jots into finished notes, using the transcript as the source of truth. In the transcript the person is "Me"; other people are labelled Speaker 1, Speaker 2, unless renamed.
    Rules: never invent facts, numbers, names, dates or commitments not in the jots or transcript. Keep the person's own words and headings where they wrote them. Fix misheard words by meaning. Write in the language of the meeting. Output Markdown only, starting with a # title of at most six words.
    """

    static func enhance(note: Note, template: Template) async throws -> String {
        let prompt = "Template instructions:\n\(template.instructions)\n\nMy jots:\n\(note.jots.isEmpty ? "(none)" : note.jots)\n\nTranscript:\n\(NoteProcessor.transcriptText(note))"
        return try await run(system: system, user: prompt)
    }

    static func chat(note: Note, question: String) async throws -> String {
        let context = "Notes:\n\(note.enhanced.isEmpty ? note.summary : note.enhanced)\n\nTranscript:\n\(NoteProcessor.transcriptText(note))"
        return try await run(system: "Answer questions about one meeting using only the notes and transcript given. If the answer is not there, say so. Be brief.", user: "\(context)\n\nQuestion: \(question)")
    }

    private static func run(system: String, user: String) async throws -> String {
        guard let engine = Summarizer.active else {
            throw NSError(domain: "VoicePet", code: 10, userInfo: [NSLocalizedDescriptionKey: "No notes writer. Add a Claude key in the frog's Me tab, or turn on Apple Intelligence."])
        }
        switch engine {
        case .claude: return try await Summarizer.claude(system: system, user: user)
        case .apple:
            let session = LanguageModelSession(instructions: system)
            return try await session.respond(to: user).content
        }
    }
}
```
`Summarizer.claude(system:user:)` does not exist yet: refactor the existing `Summarizer.claude(_ transcript:)` into `static func claude(system: String, user: String) async throws -> String` (body identical, `"system": system`, message content `user`) and make the old function call it with `instructions` and `"Transcript:\n\n\(transcript)"`. Apple's 4K window: if `user.count > 12_000` characters, truncate the transcript part to the last 12_000 characters and prepend "(transcript truncated)".

- [ ] **Step 2: Bridge commands**

In `Bridge.handle`, replace the "not implemented" arm for `enhance.run` and add `templates.list`:
```swift
        case "templates.list":
            return try jsonArray(Enhancer.templates())
        case "enhance.run":
            var note = try find(payload)
            let tid = (payload as? [String: Any])?["template"] as? String ?? note.template
            guard let t = Enhancer.templates().first(where: { $0.id == tid }) else { throw BridgeError.message("template \(tid) not found") }
            note.template = tid; note.status = "enhancing"; note.error = nil
            Store.shared.upsert(note); send(event: "note.updated", payload: note)
            do { note.enhanced = try await Enhancer.enhance(note: note, template: t); note.status = "ready" }
            catch { note.status = "ready"; note.error = error.localizedDescription }
            Store.shared.upsert(note); send(event: "note.updated", payload: note)
            if let e = note.error { throw BridgeError.message(e) }
            return ["enhanced": note.enhanced]
        case "chat.ask":
            let note = try find(payload)
            let q = (payload as? [String: Any])?["question"] as? String ?? ""
            return ["answer": try await Enhancer.chat(note: note, question: q)]
```

- [ ] **Step 3: TS side**

`types.ts`: add `Template` and `'templates.list'`. `fixtures/notes.ts`: `FIXTURE_TEMPLATES` with the same four ids/names. `mock.ts`: `'templates.list': () => FIXTURE_TEMPLATES`. Run `npx vitest run` (mock tests still pass) and `npm run check-types`.

- [ ] **Step 4: Build and check templates land on disk**

```bash
./build.sh && open build/VoicePet.app --args --notes; sleep 3; ls ~/Library/Application\ Support/VoicePet/templates/
```
Expected after the first `templates.list` call (Task 3.3 triggers it; for now run `VoicePet --enhance-test <noteId>` is not available, so verify in Task 3.3).

- [ ] **Step 5: Commit**

```bash
git add Sources/VoicePet/Enhancer.swift Sources/VoicePet/Summarizer.swift Sources/VoicePet/Bridge.swift web/notes/src
git commit -m "feat(enhance): templates on disk, Enhancer (jots+transcript) and chat over Claude/Apple"
git push
```

---

### Task 3.2: LiveTranscriber in Swift

**Files:**
- Create: `Sources/VoicePet/LiveTranscriber.swift`
- Modify: `Sources/VoicePet/Meeting.swift` (`MeetingRecorder` gains `onMicSamples`/`onSysSamples` taps and a `live` property), `Sources/VoicePet/Bridge.swift` (`session.start` wires `live.onSegment`)

**Interfaces:**
- Produces: `final class LiveTranscriber { init(engine: Transcriber); var onSegment: ((Segment) -> Void)?; func start(); func feedMic(_ s: [Float]); func feedSys(_ s: [Float]); func stop() }`. Emits a `Segment` with `speaker` `"me"` or `"s1"` (live never diarizes), `start`/`end` in seconds since session start, every ~20 s of accumulated audio per channel or when a channel has ≥ 20 s of audio and 1.5 s of silence.
- `MeetingRecorder.start()` additionally calls `live?.feedMic` / `live?.feedSys` from the sample callbacks; `stop()` calls `live?.stop()`.

- [ ] **Step 1: LiveTranscriber.swift**

```swift
import Foundation

/// Provisional transcript during a session. Buffers each channel and transcribes in ~20 s chunks on a background task.
/// The final pass on stop (NoteProcessor) replaces everything this produces.
final class LiveTranscriber: @unchecked Sendable {
    private let engine: Transcriber
    private let q = DispatchQueue(label: "voicepet.live")
    private var mic: [Float] = [], sys: [Float] = []
    private var micOffset = 0.0, sysOffset = 0.0   // seconds already flushed per channel
    private var startedAt = Date()
    private var running = false
    private var timer: DispatchSourceTimer?
    var onSegment: ((Segment) -> Void)?
    static let chunkSeconds = 20.0

    init(engine: Transcriber) { self.engine = engine }

    func start() {
        q.sync { mic = []; sys = []; micOffset = 0; sysOffset = 0; startedAt = Date(); running = true }
        let t = DispatchSource.makeTimerSource(queue: q)
        t.schedule(deadline: .now() + 5, repeating: 5)
        t.setEventHandler { [weak self] in self?.flushIfDue(force: false) }
        t.resume(); timer = t
    }

    func feedMic(_ s: [Float]) { q.async { self.mic.append(contentsOf: s) } }
    func feedSys(_ s: [Float]) { q.async { self.sys.append(contentsOf: s) } }

    func stop() {
        timer?.cancel(); timer = nil
        q.sync { running = false; mic = []; sys = [] }
    }

    private func flushIfDue(force: Bool) {
        guard running else { return }
        let need = Int(Self.chunkSeconds * 16000)
        if mic.count >= need || (force && !mic.isEmpty) { let chunk = mic; mic = []; let off = micOffset; micOffset += Double(chunk.count) / 16000; transcribe(chunk, speaker: "me", offset: off) }
        if sys.count >= need || (force && !sys.isEmpty) { let chunk = sys; sys = []; let off = sysOffset; sysOffset += Double(chunk.count) / 16000; transcribe(chunk, speaker: "s1", offset: off) }
    }

    private func transcribe(_ samples: [Float], speaker: String, offset: Double) {
        guard NoteProcessor.hasSpeech(samples) else { return }
        Task.detached { [engine, onSegment] in
            guard let words = try? await engine.transcribeTimed(samples), let first = words.first, let last = words.last else { return }
            let text = AppleTranscriber.join(words)
            let seg = Segment(speaker: speaker, start: offset + first.start, end: offset + last.end, text: text)
            await MainActor.run { onSegment?(seg) }
        }
    }
}
```
`Transcriber` is a class-bound protocol (`AnyObject`); `AppleTranscriber` is usable concurrently for separate calls in practice, but Parakeet holds decoder state. Use a dedicated engine instance for live: `LiveTranscriber(engine: AppleTranscriber())` always, regardless of the user's dictation engine. Apple is fast enough for 20 s chunks and needs no model load.

- [ ] **Step 2: MeetingRecorder hooks**

In `Meeting.swift`:
```swift
    var live: LiveTranscriber?
```
In `start()`, replace the two `onSamples` lines with:
```swift
        mic.onSamples = { [weak self] s in self?.micWriter?.append(s); self?.live?.feedMic(s) }
        tap.onSamples = { [weak self] s in self?.sysWriter?.append(s); self?.live?.feedSys(s) }
```
After `isRecording = true` add `live?.start()`. In `stop()` after `tap.stop()` add `live?.stop()`.

- [ ] **Step 3: Bridge wiring**

In `Bridge.handle` `session.start`, before `app.meeting.start()`:
```swift
            let live = LiveTranscriber(engine: AppleTranscriber())
            app.meeting.live = live
```
and after the note is stored:
```swift
            live.onSegment = { [weak self] seg in
                guard let self else { return }
                self.emit(["type": "transcript.segment", "payload": ["noteId": id.uuidString, "segment": (try? self.json(seg)) ?? [:]]])
            }
```
`AppleTranscriber.prepare()` must have run once (it requests Speech authorization); call `try? await live.engine.prepare()` is not possible since `engine` is private. Add `func prepare() async throws { try await engine.prepare() }` to `LiveTranscriber` and call `try await live.prepare()` in the bridge before `meeting.start()`.

- [ ] **Step 4: Build and observe in the Web Inspector**

```bash
./build.sh && open build/VoicePet.app --args --notes
```
Start a session, talk for 45 s, open Inspect Element → Console and run `ribbit.receive = new Proxy(ribbit.receive, {apply(t, th, a){ console.log(a[0]); return t.apply(th, a) }})` before starting to see `transcript.segment` events arrive with `speaker: "me"` after ~20-25 s. On a FaceTime call, `s1` segments appear too.

- [ ] **Step 5: Commit**

```bash
git add Sources/VoicePet/LiveTranscriber.swift Sources/VoicePet/Meeting.swift Sources/VoicePet/Bridge.swift
git commit -m "feat(session): provisional live transcript in 20s chunks over transcript.segment events"
git push
```

---

### Task 3.3: Session screen (jot pad + live transcript), enhance after stop

**Files:**
- Create: `web/notes/src/features/session/model.ts`, `model.test.ts`, `components/jot-pad.tsx`, `jot-pad.stories.tsx`, `components/live-transcript.tsx`, `live-transcript.stories.tsx`, `components/session-screen.tsx`, `session-screen.stories.tsx`
- Create: `web/notes/src/features/enhance/components/template-picker.tsx`, `template-picker.stories.tsx`
- Modify: `web/notes/src/App.tsx`, `web/notes/src/features/note/components/note-detail-screen.tsx`
- Modify: `Sources/VoicePet/Meeting.swift` (auto-enhance after processing)

**Interfaces:**
- Produces (TS): `mergeLiveSegment(segments: Segment[], incoming: Segment): Segment[]` (inserts by `start`, merges with the previous segment when same speaker and gap < 1.5 s); `JotPad({ value, onChange, autosaveMs?: number, onFlush(value) })` (textarea; calls `onFlush` `autosaveMs` after the last keystroke and on blur/unmount); `LiveTranscript({ segments, names: Record<string,string> })` (auto-scrolls unless the user scrolled up more than 40px from the bottom); `SessionScreen({ bridge, noteId, onStopped })`; `TemplatePicker({ templates, value, onChange, onRun, busy })`.
- Produces (Swift): after `NoteProcessor.process` finishes in `MeetingRecorder.stop()`, if `Summarizer.active != nil`, run `Enhancer.enhance` with the note's template and store `enhanced`; status goes `processing → enhancing → ready`, emitting `note.updated` through `onNoteUpdated: ((Note) -> Void)?` on `MeetingRecorder` which `AppDelegate` forwards to `notesWindow.bridge.send(event: "note.updated", ...)`.

- [ ] **Step 1: model.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import type { Segment } from '@/bridge/types';
import { mergeLiveSegment } from './model';

const seg = (id: string, speaker: string, start: number, end: number, text: string): Segment => ({ id, speaker, start, end, text });

describe('mergeLiveSegment', () => {
  it('appends in start order', () => {
    const out = mergeLiveSegment([seg('a', 'me', 0, 5, 'hi')], seg('b', 's1', 2, 6, 'hello'));
    expect(out.map(s => s.id)).toEqual(['a', 'b']);
    const out2 = mergeLiveSegment(out, seg('c', 'me', 1, 1.5, 'oh'));
    expect(out2.map(s => s.id)).toEqual(['a', 'c', 'b']);
  });
  it('merges same-speaker segments closer than 1.5s', () => {
    const out = mergeLiveSegment([seg('a', 'me', 0, 5, 'hi there')], seg('b', 'me', 6, 9, 'again'));
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('hi there again');
    expect(out[0]!.end).toBe(9);
  });
  it('does not merge across a gap', () => {
    const out = mergeLiveSegment([seg('a', 'me', 0, 5, 'hi')], seg('b', 'me', 8, 9, 'later'));
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, expect failure. model.ts:**

```ts
import type { Segment } from '@/bridge/types';

export function mergeLiveSegment(segments: Segment[], incoming: Segment): Segment[] {
  const out = [...segments];
  let i = out.findIndex(s => s.start > incoming.start);
  if (i === -1) i = out.length;
  const prev = out[i - 1];
  if (prev && prev.speaker === incoming.speaker && incoming.start - prev.end < 1.5) {
    out[i - 1] = { ...prev, end: Math.max(prev.end, incoming.end), text: `${prev.text} ${incoming.text}`.trim() };
    return out;
  }
  out.splice(i, 0, incoming);
  return out;
}
```

- [ ] **Step 3: Run, expect pass.**

- [ ] **Step 4: jot-pad.tsx, live-transcript.tsx, template-picker.tsx**

`jot-pad.tsx`:
```tsx
import { useEffect, useRef } from 'react';

/** Borderless textarea that fills its pane. Placeholder explains jots. Debounced `onFlush` for autosave. */
export function JotPad({ value, onChange, onFlush, autosaveMs = 2000 }: { value: string; onChange: (v: string) => void; onFlush: (v: string) => void; autosaveMs?: number }) {
  const t = useRef<number | null>(null);
  const latest = useRef(value); latest.current = value;
  useEffect(() => () => { if (t.current) { window.clearTimeout(t.current); onFlush(latest.current); } }, [onFlush]);
  const change = (v: string) => { onChange(v); if (t.current) window.clearTimeout(t.current); t.current = window.setTimeout(() => onFlush(v), autosaveMs); };
  return (
    <textarea value={value} onChange={e => change(e.target.value)} onBlur={() => onFlush(value)} spellCheck
      placeholder={"Jot as you go. Fragments are fine:\n- pricing?\n- Fiona owns landing page\nRibbit fills in the rest after the call."}
      className="h-full w-full resize-none bg-transparent px-6 py-4 font-sans text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint" />
  );
}
```
`live-transcript.tsx`:
```tsx
import type { Segment } from '@/bridge/types';
import { TranscriptTurn } from '@/features/note/components/transcript-turn';
import { useEffect, useRef } from 'react';

/** Right pane during a session: provisional turns, newest at the bottom, auto-scroll unless the user scrolled up. */
export function LiveTranscript({ segments, names }: { segments: Segment[]; names: Record<string, string> }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [segments]);
  const onScroll = () => { const el = box.current!; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; };
  const label = (s: string) => names[s] ?? (s === 'me' ? 'Me' : `Speaker ${s.slice(1)}`);
  return (
    <div ref={box} onScroll={onScroll} className="h-full overflow-y-auto border-l border-line bg-surface px-4">
      {segments.length === 0 && <p className="px-2 py-6 text-[13px] text-faint">Listening. The first lines show up after about 20 seconds.</p>}
      {segments.map(s => <TranscriptTurn key={s.id} segment={s} name={label(s.speaker)} />)}
    </div>
  );
}
```
`template-picker.tsx`:
```tsx
import type { Template } from '@/bridge/types';
import { Button } from '@/shared/components/ui/button';
import { Sparkles } from 'lucide-react';

/** Select of templates plus an Enhance button. `busy` disables both and shows "Enhancing…". */
export function TemplatePicker({ templates, value, onChange, onRun, busy }: { templates: Template[]; value: string; onChange: (id: string) => void; onRun: () => void; busy?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={busy} aria-label="Template" className="h-8 rounded-control border border-line bg-surface px-2 text-[13px]">
        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <Button variant="text" size="sm" onClick={onRun} disabled={busy}><Sparkles /> {busy ? 'Enhancing…' : 'Enhance'}</Button>
    </div>
  );
}
```

- [ ] **Step 5: session-screen.tsx**

```tsx
import type { Bridge, Note, Segment } from '@/bridge/types';
import { useEffect, useState } from 'react';
import { mergeLiveSegment } from '../model';
import { JotPad } from './jot-pad';
import { LiveTranscript } from './live-transcript';

/** During a session: jot pad (60%) and live transcript (40%). The SessionBar above it belongs to App. Jots autosave via notes.update. When note.updated reports a non-recording status the parent switches to the detail view. */
export function SessionScreen({ bridge, noteId, onStopped }: { bridge: Bridge; noteId: string; onStopped: () => void }) {
  const [note, setNote] = useState<Note | null>(null);
  const [jots, setJots] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    let alive = true;
    bridge.call('notes.get', { id: noteId }).then(n => { if (alive) { setNote(n); setJots(n.jots); setSegments(n.segments); } });
    const offSeg = bridge.on('transcript.segment', e => { if (e.noteId === noteId) setSegments(prev => mergeLiveSegment(prev, e.segment)); });
    const offNote = bridge.on('note.updated', n => { if (n.id === noteId) { setNote(n); if (n.status !== 'recording') onStopped(); } });
    return () => { alive = false; offSeg(); offNote(); };
  }, [bridge, noteId, onStopped]);

  if (!note) return null;
  const flush = (v: string) => { void bridge.call('notes.update', { id: noteId, patch: { jots: v } }); };
  return (
    <div className="grid h-full grid-cols-[3fr_2fr]">
      <JotPad value={jots} onChange={setJots} onFlush={flush} />
      <LiveTranscript segments={segments} names={note.speakerNames} />
    </div>
  );
}
```
Because `notes.update` emits `note.updated` for the same note, the handler above must not call `onStopped` on jots saves: the status is still `recording`, so it will not. Do not `setJots` from `note.updated` (it would clobber typing).

- [ ] **Step 6: Auto-enhance after processing (Swift)**

In `MeetingRecorder.stop()`, inside the existing `Task` after `n = try await NoteProcessor.process(...)` and before `Store.shared.upsert(n)`:
```swift
                    if Summarizer.active != nil, let t = Enhancer.templates().first(where: { $0.id == n.template }) ?? Enhancer.templates().first {
                        n.status = "enhancing"; Store.shared.upsert(n); self?.onNoteUpdated?(n)
                        do { n.enhanced = try await Enhancer.enhance(note: n, template: t) } catch { n.error = error.localizedDescription }
                    }
                    n.status = "ready"
```
Add `var onNoteUpdated: ((Note) -> Void)?` to `MeetingRecorder` and call it wherever `Store.shared.upsert(n)` happens in `stop()`. In `AppDelegate.applicationDidFinishLaunching`: `meeting.onNoteUpdated = { [weak self] n in self?.notesWindow.bridge.send(event: "note.updated", payload: n) }`. Remove the ad-hoc `note.updated` forwarding added in the foundation plan Task 2.2 if it now duplicates.

- [ ] **Step 7: App.tsx and NoteDetailScreen**

App: when `session` is set and `selected === session.noteId`, render `<SessionScreen bridge noteId onStopped={() => setSession(null)} />` instead of `NoteDetailScreen`. `start()` sets both.
NoteDetailScreen: load `templates.list` once; in the Notes tab, render `<TemplatePicker templates value={note.template} onChange={t => patch({ template: t })} onRun={() => void bridge.call('enhance.run', { id, template: note.template }).catch(() => {})} busy={note.status === 'enhancing'} />` above `SummaryView`. Errors surface through `note.error` in `SummaryView`.

- [ ] **Step 8: Stories**

`'Session/JotPad'` (stateful), `'Session/LiveTranscript'` (`Default` with four segments, `Empty`), `'Session/SessionScreen'` (mock bridge with `n-processing` patched to `status: 'recording'`; a `play` function or a `setInterval` in `render` calling `bridge.emit('transcript.segment', ...)` every 3 s from a scripted list so the feed visibly grows), `'Enhance/TemplatePicker'` (`Default`, `Busy`).

- [ ] **Step 9: Build and run the full loop**

Start from the window → jot three lines while talking on a FaceTime call → watch live turns arrive → Stop → Processing → Enhancing → Notes tab shows enhanced markdown that references your jots → Jots tab shows what you typed → change template to 1:1 → Enhance → text changes.

- [ ] **Step 10: Commit**

```bash
git add web/notes/src Sources/VoicePet/Meeting.swift Sources/VoicePet/AppDelegate.swift
git commit -m "feat(session): jot pad, live transcript, auto-enhance after stop, template picker"
git push
```

---

### Task 3.4: Inline speaker rename popover

**Files:**
- Create: `web/notes/src/features/note/components/rename-popover.tsx`, `rename-popover.stories.tsx`
- Modify: `web/notes/src/features/note/components/transcript-feed.tsx`, `note-detail-screen.tsx`
- Modify: `Sources/VoicePet/NotesWindow.swift` (remove the `runJavaScriptTextInputPanelWithPrompt` stopgap)

**Interfaces:**
- Produces: `RenamePopover({ speaker, current, suggestions: string[], onSubmit(name), onClose })`: small card anchored under the chip with a text input, suggestion chips (attendee names), Save/Cancel; Escape closes, Enter saves.
- `TranscriptFeed` gains `suggestions: string[]` and owns the popover state (`openFor: speaker | null`), calling `onRenameSpeaker(speaker, name)`.

- [ ] **Step 1: rename-popover.tsx**

```tsx
import { Button } from '@/shared/components/ui/button';
import { Chip } from '@/shared/components/ui/chip';
import { useEffect, useRef, useState } from 'react';

/** Card under a speaker chip: text field, attendee suggestion chips, Save / Cancel. Enter saves, Escape closes. */
export function RenamePopover({ current, suggestions, onSubmit, onClose }: { speaker: string; current: string; suggestions: string[]; onSubmit: (name: string) => void; onClose: () => void }) {
  const [v, setV] = useState(current);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const submit = () => { if (v.trim()) onSubmit(v.trim()); onClose(); };
  return (
    <div role="dialog" aria-label="Rename speaker" className="absolute z-10 mt-1 w-64 rounded-card border border-line bg-surface p-3 shadow-lg" onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') submit(); }}>
      <input ref={ref} value={v} onChange={e => setV(e.target.value)} className="h-8 w-full rounded-control border border-line px-2 text-[13px] outline-none focus:border-brand" />
      {suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{suggestions.map(s => <button key={s} type="button" onClick={() => setV(s)}><Chip tone={s === v ? 'brand' : 'neutral'}>{s}</Chip></button>)}</div>}
      <div className="mt-3 flex justify-end gap-2"><Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={submit}>Save</Button></div>
    </div>
  );
}
```

- [ ] **Step 2: TranscriptFeed owns the popover**

Wrap each `TranscriptTurn` in a `relative` div; when `openFor === segment.speaker` for the first turn of that speaker, render `<RenamePopover ... />` below it. `suggestions` = `note.attendees.map(a => a.name)`. `onRenameSpeaker(speaker, name)` replaces the old single-arg callback. In `NoteDetailScreen`, `onRenameSpeaker={(s, name) => patch({ speakerNames: renameSpeaker(note, s, name).speakerNames })}`. Delete the `window.prompt` line and the Swift `runJavaScriptTextInputPanelWithPrompt` override.

- [ ] **Step 3: Story** `'Note/RenamePopover'` with suggestions `['Fiona Park', 'Dylan Reyes']`. Update `'Note/TranscriptFeed'` story to include a `RenameOpen` state via a `play` that clicks the first chip.

- [ ] **Step 4: Verify in Storybook and in the app, commit**

```bash
git add web/notes/src Sources/VoicePet/NotesWindow.swift
git commit -m "feat(notes): inline speaker rename popover with attendee suggestions"
git push
```

---

## Phase 4: calendar and call detection

### Task 4.1: CalendarSource (EventKit) and the upcoming card

**Files:**
- Create: `Sources/VoicePet/CalendarSource.swift`
- Modify: `Resources/Info.plist`, `Sources/VoicePet/Bridge.swift` (`calendar.upcoming`, `calendar.authorize`, `settings.calendarEnabled`), `Sources/VoicePet/AppDelegate.swift` (`let calendar = CalendarSource()`)
- Create: `web/notes/src/features/calendar/components/upcoming-card.tsx`, `upcoming-card.stories.tsx`
- Modify: `web/notes/src/features/library/components/library-screen.tsx` (renders `upcoming` prop above the list), `web/notes/src/App.tsx`, `web/notes/src/features/settings/components/settings-screen.tsx`

**Interfaces:**
- Produces (Swift): `@MainActor final class CalendarSource { var enabled: Bool (UserDefaults "calendarOn"); func authorize() async -> Bool; func upcoming(hours: Double) -> [CalendarEvent]; func closest(to: Date) -> CalendarEvent? }`; `struct CalendarEvent: Codable { var id: String; var title: String; var start: Date; var end: Date; var attendees: [Attendee] }`.
- Produces (TS): `UpcomingCard({ events, onStart(event) })`: up to two events with title, start time, attendee initials, and a "Take notes" button on the one starting within 15 minutes (others show the time only).

- [ ] **Step 1: Info.plist**

Add inside `<dict>`:
```xml
  <key>NSCalendarsFullAccessUsageDescription</key><string>Ribbit reads your calendar to suggest notes for upcoming meetings and to name who was there. Nothing leaves this Mac.</string>
```

- [ ] **Step 2: CalendarSource.swift**

```swift
import EventKit
import Foundation

struct CalendarEvent: Codable, Equatable {
    var id: String
    var title: String
    var start: Date
    var end: Date
    var attendees: [Attendee]
}

/// EventKit wrapper. Reads only; never writes.
@MainActor
final class CalendarSource {
    private let store = EKEventStore()
    var enabled: Bool {
        get { UserDefaults.standard.object(forKey: "calendarOn") as? Bool ?? false }
        set { UserDefaults.standard.set(newValue, forKey: "calendarOn") }
    }
    var authorized: Bool { EKEventStore.authorizationStatus(for: .event) == .fullAccess }

    func authorize() async -> Bool {
        if authorized { return true }
        return (try? await store.requestFullAccessToEvents()) ?? false
    }

    func upcoming(hours: Double) -> [CalendarEvent] {
        guard enabled, authorized else { return [] }
        let now = Date()
        let pred = store.predicateForEvents(withStart: now.addingTimeInterval(-15 * 60), end: now.addingTimeInterval(hours * 3600), calendars: nil)
        return store.events(matching: pred)
            .filter { !$0.isAllDay }
            .sorted { $0.startDate < $1.startDate }
            .map { convert($0) }
    }

    func closest(to date: Date) -> CalendarEvent? {
        upcoming(hours: 1).min { abs($0.start.timeIntervalSince(date)) < abs($1.start.timeIntervalSince(date)) }
    }

    private func convert(_ e: EKEvent) -> CalendarEvent {
        let people = (e.attendees ?? []).filter { !$0.isCurrentUser }.map { Attendee(name: $0.name ?? $0.url.absoluteString.replacingOccurrences(of: "mailto:", with: ""), email: $0.url.scheme == "mailto" ? String($0.url.absoluteString.dropFirst(7)) : nil) }
        return CalendarEvent(id: e.eventIdentifier ?? UUID().uuidString, title: e.title ?? "Untitled", start: e.startDate, end: e.endDate, attendees: people)
    }
}
```

- [ ] **Step 3: Bridge arms**

```swift
        case "calendar.authorize":
            let ok = await app.calendar.authorize()
            if ok { app.calendar.enabled = true }
            return ["granted": ok]
        case "calendar.upcoming":
            let h = (payload as? [String: Any])?["hours"] as? Double ?? 12
            return try jsonArray(app.calendar.upcoming(hours: h))
```
In `settings.set`: `if let v = p["calendarEnabled"] as? Bool { app.calendar.enabled = v }`. In `settingsDict`: `"calendarEnabled": app?.calendar.enabled ?? false`. In `session.start`: if `calendarEventID` is given, look it up with `app.calendar.upcoming(hours: 12).first { $0.id == e }` and copy `title` (if none given) and `attendees` onto the note.

- [ ] **Step 4: upcoming-card.tsx**

```tsx
import type { CalendarEvent } from '@/bridge/types';
import { Button } from '@/shared/components/ui/button';
import { initials } from '@/shared/utils/format';
import { Calendar } from 'lucide-react';

/** Sidebar card listing up to two upcoming events. The one starting within 15 minutes (or already started) gets a "Take notes" button. */
export function UpcomingCard({ events, onStart, now = Date.now() }: { events: CalendarEvent[]; onStart: (e: CalendarEvent) => void; now?: number }) {
  if (events.length === 0) return null;
  return (
    <div className="mx-3 mt-3 rounded-card border border-line bg-canvas p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint"><Calendar className="size-3.5" /> Upcoming</div>
      {events.slice(0, 2).map(e => {
        const soon = new Date(e.start).getTime() - now < 15 * 60_000;
        const t = new Date(e.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={e.id} className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{e.title}</div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted"><span className="tabular-nums">{t}</span><span className="flex -space-x-1">{e.attendees.slice(0, 3).map(a => <span key={a.name} title={a.name} className="grid size-4 place-items-center rounded-full border border-surface bg-well text-[8px] font-bold text-body">{initials(a.name)}</span>)}</span></div>
            </div>
            {soon && <Button size="sm" onClick={() => onStart(e)}>Take notes</Button>}
          </div>
        );
      })}
    </div>
  );
}
```
`LibraryScreen` takes `upcoming?: ReactNode` and renders it between the Start button and the list. `App` loads `calendar.upcoming` (`hours: 12`) on mount and every 5 minutes when `settings.calendarEnabled`, and `onStart(e)` calls `session.start` with `{ title: e.title, calendarEventID: e.id }`.
Settings: a "Calendar" row with a checkbox; turning it on calls `calendar.authorize` first and reflects `granted`. When denied, hint "Allow calendar access in System Settings › Privacy & Security › Calendars."

- [ ] **Step 5: Stories** `'Calendar/UpcomingCard'`: `Soon` (first event in 5 min), `Later`, `Empty`.

- [ ] **Step 6: Build, grant calendar, see the card, start from it, check attendees appear in the header and as rename suggestions. Commit.**

```bash
git add Sources/VoicePet/CalendarSource.swift Sources/VoicePet/Bridge.swift Sources/VoicePet/AppDelegate.swift Resources/Info.plist web/notes/src
git commit -m "feat(calendar): EventKit upcoming events, take-notes card, attendees onto notes"
git push
```

---

### Task 4.2: CallDetector and the prompt

**Files:**
- Create: `Sources/VoicePet/CallDetector.swift`
- Modify: `Sources/VoicePet/AppDelegate.swift` (owns detector; shows prompt), `Sources/VoicePet/Bridge.swift` (`settings.callDetection`)
- Create: `web/notes/src/features/calendar/components/call-prompt.tsx`, `call-prompt.stories.tsx`
- Modify: `web/notes/src/App.tsx`, `settings-screen.tsx`

**Interfaces:**
- Produces (Swift): `@MainActor final class CallDetector { static let knownApps: [(id: String, name: String)]; var enabled: [String: Bool] (UserDefaults "callApps", default all on); var onCall: ((String) -> Void)?; func start(); func stop(); func snooze(_ bundleID: String, minutes: Int) }`. Rising edge = (default input device running somewhere) && (an enabled known app is running) && not snoozed && not already in a session.
- Produces (TS): `CallPrompt({ app, event?, onAccept, onDismiss })`: bottom-right toast inside the window with "Looks like a call in Zoom. Take notes for *Weekly with Priya*?" and Accept / Not now.
- Prompt surfaces in two places: the notes window (event `call.detected` → toast) and, when the window is hidden, a native `NSUserNotification`-free approach: the frog panel says "Take notes?" via `voice` and the status bar item gets a badge. Keep v1 to: emit the event, and if the notes window is not visible, `notesWindow.show()` so the toast is seen.

- [ ] **Step 1: CallDetector.swift**

```swift
import AppKit
import CoreAudio
import Foundation

/// Polls every 5 s: is the default input device in use by anyone while a known call app is running?
/// Fires `onCall(bundleID)` on the rising edge. Never records by itself.
@MainActor
final class CallDetector {
    static let knownApps: [(id: String, name: String)] = [
        ("us.zoom.xos", "Zoom"), ("com.microsoft.teams2", "Teams"), ("com.microsoft.teams", "Teams"),
        ("com.apple.FaceTime", "FaceTime"), ("com.tinyspeck.slackmacgap", "Slack"),
        ("com.google.Chrome", "Chrome"), ("com.apple.Safari", "Safari"), ("company.thebrowser.Browser", "Arc"),
    ]
    var onCall: ((String) -> Void)?
    var isBusy: () -> Bool = { false }
    private var timer: Timer?
    private var wasActive = false
    private var snoozed: [String: Date] = [:]

    var enabled: [String: Bool] {
        get { let d = UserDefaults.standard.dictionary(forKey: "callApps") as? [String: Bool] ?? [:]; return Dictionary(uniqueKeysWithValues: Self.knownApps.map { ($0.id, d[$0.id] ?? true) }) }
        set { UserDefaults.standard.set(newValue, forKey: "callApps") }
    }

    func start() {
        stop()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in Task { @MainActor in self?.tick() } }
    }
    func stop() { timer?.invalidate(); timer = nil }
    func snooze(_ id: String, minutes: Int) { snoozed[id] = Date().addingTimeInterval(Double(minutes) * 60) }

    private func tick() {
        let running = NSWorkspace.shared.runningApplications.compactMap(\.bundleIdentifier)
        let app = Self.knownApps.first { enabled[$0.id] == true && running.contains($0.id) }
        let active = app != nil && Self.inputRunningSomewhere()
        defer { wasActive = active }
        guard active, !wasActive, let app, !isBusy() else { return }
        if let until = snoozed[app.id], until > Date() { return }
        onCall?(app.id)
    }

    static func inputRunningSomewhere() -> Bool {
        var dev = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &dev) == noErr, dev != kAudioObjectUnknown else { return false }
        var running: UInt32 = 0
        size = UInt32(MemoryLayout<UInt32>.size)
        addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        guard AudioObjectGetPropertyData(dev, &addr, 0, nil, &size, &running) == noErr else { return false }
        return running != 0
    }
}
```
Browsers: `inputRunningSomewhere` plus Chrome running is a weak signal (any tab with mic). Accept it for v1; the prompt is cheap to dismiss and per-app toggles exist.

- [ ] **Step 2: AppDelegate wiring**

```swift
    let calendar = CalendarSource()
    let detector = CallDetector()
```
In `applicationDidFinishLaunching`:
```swift
        detector.isBusy = { [weak self] in (self?.meeting.isRecording ?? false) || (self?.listening ?? false) }
        detector.onCall = { [weak self] id in
            guard let self else { return }
            let ev = self.calendar.closest(to: Date())
            struct P: Encodable { var app: String; var event: CalendarEvent? }
            if !self.notesWindow.isVisible { self.notesWindow.show() }
            self.notesWindow.bridge.send(event: "call.detected", payload: P(app: id, event: ev))
        }
        detector.start()
```
Bridge: `settings.set` handles `callDetection: [String: Bool]` → `app.detector.enabled = merged`; `settingsDict` returns `app.detector.enabled`. Add command `'call.snooze': { payload: { app: string }; reply: 'ok' }` in `types.ts`/`mock.ts` and the Swift arm `app.detector.snooze(id, minutes: 10)`.

- [ ] **Step 3: call-prompt.tsx**

```tsx
import type { CalendarEvent } from '@/bridge/types';
import { Button } from '@/shared/components/ui/button';
import { Mic } from 'lucide-react';

const NAMES: Record<string, string> = { 'us.zoom.xos': 'Zoom', 'com.microsoft.teams2': 'Teams', 'com.microsoft.teams': 'Teams', 'com.apple.FaceTime': 'FaceTime', 'com.tinyspeck.slackmacgap': 'Slack', 'com.google.Chrome': 'Chrome', 'com.apple.Safari': 'Safari', 'company.thebrowser.Browser': 'Arc' };

/** Bottom-right toast: "Looks like a call in Zoom. Take notes for <event>?" with Accept and Not now. */
export function CallPrompt({ app, event, onAccept, onDismiss }: { app: string; event?: CalendarEvent; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div role="dialog" aria-label="Call detected" className="fixed bottom-4 right-4 w-80 rounded-card border border-line bg-surface p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"><Mic className="size-4" /></span>
        <div className="min-w-0 flex-1 text-[13px] text-ink">
          Looks like a call in {NAMES[app] ?? app}.{' '}
          {event ? <>Take notes for <strong>{event.title}</strong>?</> : 'Take notes?'}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2"><Button variant="quiet" size="sm" onClick={onDismiss}>Not now</Button><Button size="sm" onClick={onAccept}>Take notes</Button></div>
    </div>
  );
}
```
App: subscribe to `call.detected` → set `prompt`; Accept → `session.start({ title: event?.title, calendarEventID: event?.id })`; Not now → `call.snooze({ app })`. Settings: a "Call detection" section with one checkbox per known app.

- [ ] **Step 4: Story** `'Calendar/CallPrompt'`: `WithEvent`, `NoEvent`.

- [ ] **Step 5: Build, open FaceTime and start a call to yourself: within 5 s the window comes forward with the toast. Not now → no re-prompt for 10 min. Accept → session starts with the event title. Commit.**

```bash
git add Sources/VoicePet/CallDetector.swift Sources/VoicePet/AppDelegate.swift Sources/VoicePet/Bridge.swift web/notes/src
git commit -m "feat(calls): detect calls in known apps and prompt to take notes; per-app toggles and snooze"
git push
```

---

## Phase 5: chat and export

### Task 5.1: Chat with a note

**Files:**
- Create: `web/notes/src/features/enhance/components/chat-box.tsx`, `chat-box.stories.tsx`
- Modify: `web/notes/src/features/note/components/note-detail-screen.tsx`

**Interfaces:**
- Produces: `ChatBox({ onAsk(question): Promise<string> })`: input pinned at the bottom of the Notes tab; each Q/A pair renders above it in a bubble list kept in component state (not persisted). Enter sends; shows "Thinking…" while pending; errors render inline in the answer slot.

- [ ] **Step 1: chat-box.tsx**

```tsx
import { Button } from '@/shared/components/ui/button';
import { Markdown } from '@/shared/components/ui/markdown';
import { Send } from 'lucide-react';
import { useState } from 'react';

interface Turn { q: string; a: string | null; error?: string }

/** Ask-the-note box. Q/A pairs stack above the input; state lives here only. */
export function ChatBox({ onAsk }: { onAsk: (q: string) => Promise<string> }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const send = async () => {
    const question = q.trim(); if (!question) return;
    setQ(''); setTurns(t => [...t, { q: question, a: null }]);
    try { const a = await onAsk(question); setTurns(t => t.map((x, i) => i === t.length - 1 ? { ...x, a } : x)); }
    catch (e) { setTurns(t => t.map((x, i) => i === t.length - 1 ? { ...x, a: '', error: (e as Error).message } : x)); }
  };
  return (
    <div className="border-t border-line px-6 py-3">
      {turns.map((t, i) => (
        <div key={i} className="mb-3">
          <div className="text-[13px] font-semibold text-body">{t.q}</div>
          <div className="mt-1 text-[13px]">{t.error ? <span className="text-danger">{t.error}</span> : t.a === null ? <span className="text-faint">Thinking…</span> : <Markdown source={t.a} />}</div>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void send(); }} placeholder="Ask about this meeting…" className="h-8 flex-1 rounded-control border border-line bg-surface px-3 text-[13px] outline-none focus:border-brand" />
        <Button variant="soft" size="icon" aria-label="Send" onClick={() => void send()}><Send /></Button>
      </div>
    </div>
  );
}
```
In `NoteDetailScreen` Notes tab: `<ChatBox onAsk={q => bridge.call('chat.ask', { id, question: q }).then(r => r.answer)} />` below `SummaryView` (outside the scrolling area, pinned).

- [ ] **Step 2: Story** `'Enhance/ChatBox'` with a mock `onAsk` that resolves after 800 ms.

- [ ] **Step 3: Build, ask "what did we decide?" on a real note, get an answer. Commit.**

```bash
git add web/notes/src
git commit -m "feat(notes): chat with a note"
git push
```

---

### Task 5.2: Copy menu and export

**Files:**
- Modify: `web/notes/src/features/note/components/note-header.tsx` (Copy becomes a small menu: Notes, Transcript, Jots), `web/notes/src/shared/components/ui/dropdown.tsx` (new, minimal: button + absolutely positioned list, closes on outside click and Escape), `dropdown.stories.tsx`

- [ ] **Step 1: dropdown.tsx**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Minimal menu: trigger + list. Closes on outside click or Escape. Items are buttons. */
export function Dropdown({ trigger, items }: { trigger: ReactNode; items: { label: string; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 min-w-40 rounded-card border border-line bg-surface p-1 shadow-lg">
          {items.map(i => <button key={i.label} role="menuitem" type="button" onClick={() => { setOpen(false); i.onSelect(); }} className="block w-full rounded-control px-3 py-1.5 text-left text-[13px] text-ink hover:bg-line-soft">{i.label}</button>)}
        </div>
      )}
    </div>
  );
}
```
`NoteHeader`: `<Dropdown trigger={<Button variant="soft" size="sm"><Copy /> Copy</Button>} items={[{ label: 'Notes', onSelect: () => onCopy('enhanced') }, { label: 'Transcript', onSelect: () => onCopy('transcript') }, { label: 'Jots', onSelect: () => onCopy('jots') }]} />`.

- [ ] **Step 2: Story, build, verify each copies the right text. Commit.**

```bash
git add web/notes/src
git commit -m "feat(notes): copy menu for notes, transcript, jots"
git push
```

---

## Phase 6: polish and release

### Task 6.1: Signing identity, menu, README, release zip

**Files:**
- Modify: `README.md`, `Resources/Info.plist` (`CFBundleDisplayName` → `Ribbit`, `CFBundleShortVersionString` → `0.2.0`; bundle id unchanged), `Sources/VoicePet/StatusBar.swift` ("Quit Frog" → "Quit Ribbit"; window item first in the menu)
- Create: `docs/RELEASE.md`

- [ ] **Step 1: Local signing identity** so permissions survive rebuilds (build.sh already looks for "VoicePet Dev"):

```bash
cat > /tmp/voicepet-dev.conf <<'EOF'
[ req ]
distinguished_name = dn
x509_extensions = ext
prompt = no
[ dn ]
CN = VoicePet Dev
[ ext ]
keyUsage = digitalSignature
extendedKeyUsage = codeSigning
EOF
openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/vp.key -out /tmp/vp.crt -days 3650 -config /tmp/voicepet-dev.conf
openssl pkcs12 -export -inkey /tmp/vp.key -in /tmp/vp.crt -out /tmp/vp.p12 -passout pass:x
security import /tmp/vp.p12 -k ~/Library/Keychains/login.keychain-db -P x -T /usr/bin/codesign
security find-identity -v -p codesigning | grep "VoicePet Dev"
```
Then Keychain Access → the "VoicePet Dev" certificate → Trust → Code Signing: Always Trust. Rebuild: `./build.sh` prints `signed with VoicePet Dev`.

- [ ] **Step 2: docs/RELEASE.md**

```markdown
# Releasing Ribbit

1. `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer && ./build.sh`
2. `ditto -c -k --keepParent build/VoicePet.app Ribbit.zip`
3. `gh release create v0.2.0 Ribbit.zip --title "Ribbit 0.2.0" --notes "..."`
4. Installing on another Mac: unzip, drag to Applications, right-click → Open once (unsigned by an Apple Developer ID). Grant Microphone, Speech Recognition, Accessibility, System Audio Recording, Calendars when asked.

Notarisation needs an Apple Developer account ($99/yr); not done for 0.2.
```

- [ ] **Step 3: README** top section rewrite (Ribbit first, Frog credit second), feature list matching the spec, the model table unchanged, install steps, the `web/notes` dev loop, licence block naming Frog (MIT), FluidAudio (Apache 2), llama.cpp (MIT), Parakeet (CC-BY 4.0), Gemma (Gemma terms, downloaded at runtime).

- [ ] **Step 4: Full manual pass** of the spec's Features section on a real call, then commit, PR, ff-merge, tag `v0.2.0`, release zip.

```bash
git add README.md Resources/Info.plist Sources/VoicePet/StatusBar.swift docs/RELEASE.md
git commit -m "chore(release): Ribbit 0.2.0 naming, signing notes, release steps"
git push
gh pr create --title "feat: Ribbit session, calendar, call detection, chat (phases 3-6)" --body "Spec: docs/superpowers/specs/2026-09-14-granola-notes-ui-design.md

https://claude.ai/code/session_018tEz5ixahNQVj1tCGkkwZn"
```

---

## Self-review notes

- Spec coverage: Session (jots, live transcript, timer via SessionBar from plan 1, stop → process → enhance) Tasks 3.2-3.3; Enhance + templates 3.1/3.3; Chat 5.1; Calendar + upcoming card 4.1; Call detection + prompt + snooze + per-app toggles 4.2; speaker rename with attendee suggestions 3.4; Settings rows for calendar and call detection 4.1/4.2; export 5.2; error handling: tap failure banner is not covered by a task. Add to Task 3.3 Step 7: `SessionScreen` shows a `warn-soft` banner "Only recording you. Grant System Audio Recording in System Settings." when `note.error` contains "Recording you only".
- Type consistency: `Template`, `CalendarEvent`, `Attendee`, `Segment`, `Note` shapes match the Swift structs (dates ISO 8601 via `Bridge.encoder`). `onRenameSpeaker(speaker, name)` two-arg form replaces plan 1's one-arg form in Task 3.4. `MeetingRecorder.onNoteUpdated` replaces the ad-hoc forwarding from plan 1 Task 2.2.
- Stopgap removed: `window.prompt` (Task 3.4).
