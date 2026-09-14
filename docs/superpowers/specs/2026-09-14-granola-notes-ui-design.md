# Ribbit Notes: a Granola-style meeting notes UI on top of Frog

Date: 2026-09-14. Status: approved design, not yet built.

Ribbit is a fork of [Pyanov/frog](https://github.com/Pyanov/frog) (MIT). Frog already does the hard part: bot-free capture of both sides of a call (mic + Core Audio process tap), on-device transcription (Apple SpeechAnalyzer or Parakeet v3), speaker diarization (FluidAudio), and a local summary (Apple Intelligence, or Claude with a key). What it lacks is Granola's workflow: it never knows you are in a meeting, gives you nowhere to jot during the call, and produces a transcript plus summary only after you press stop.

This spec adds that workflow as a React + Storybook UI inside the existing app, without touching the recording engine.

## Goals

1. Install one `.app` on a Mac and get Granola-quality meeting notes with nothing leaving the machine by default.
2. Auto-detect meetings (calendar + call detection) and ask to take notes. Never record silently.
3. During the call: a jot pad and a live transcript. After: your jots enhanced with the transcript into structured notes.
4. Every visual piece is a Storybook brick first, wired to real data second (workout-hub-next / front-law conventions).
5. Fully open-source. Optional cloud features are behind an interface and out of scope for v1.

## Non-goals (v1)

Team workspaces, share links, sync, Slack/Notion push, mobile, Windows. Changing the frog itself (it stays, hideable). Replacing the dictation or chat features.

## Approach

Approach A from the brainstorm: React UI in a second `WKWebView` window inside the forked Swift app, talking to Swift over a JSON message bridge. The bridge is a message protocol, not direct calls, so the UI could later run against a headless engine (approach B) without a rewrite.

Rejected: a separate Tauri/Electron app (two processes, IPC, packaging, a week more work) and an Electron rewrite (throws away the working engine).

## Architecture

```
Sources/VoicePet/                     Swift engine (existing, unchanged unless noted)
  Meeting.swift        MeetingRecorder + NoteProcessor         (existing)
  SystemAudioTap.swift AudioRecorder.swift Transcriber.swift  (existing)
  Summarizer.swift     Store.swift                            (existing; Store gains jots + attendees)
  NotesWindow.swift    NSWindow + WKWebView hosting web/notes  (new)
  Bridge.swift         WKScriptMessageHandler, JSON in/out     (new)
  CalendarSource.swift EventKit: upcoming events + attendees   (new)
  CallDetector.swift   mic-in-use + known call apps -> prompt  (new)
  LiveTranscriber.swift chunked transcription during a call   (new)
  Enhancer.swift       jots + transcript + template -> notes   (new)
  Hub.swift            NotesView/NoteDetail removed; Notes tab opens NotesWindow

web/                  three.js frog (existing, untouched)
web/notes/            React 19 + TS + Vite + Tailwind 4 + Storybook 10 + Vitest (new)
  src/shared/components/ui/   primitives
  src/shared/brand/           wordmark, palette story
  src/features/library/       note list, search, note detail
  src/features/session/       live session screen, jot pad, transcript feed, model.ts
  src/features/enhance/       enhanced notes view, template picker, chat-with-note
  src/features/calendar/      upcoming card, "take notes?" prompt
  src/features/settings/      engines, keys, templates, call apps
  src/bridge/                 typed contract + WKWebView transport + mock transport for Storybook
  src/App.tsx                 router between library / session / settings
  DESIGN.md                   tokens, documented like workout-hub-next
```

`build.sh` gains one step: build `web/notes` and copy its single-file bundle to `Contents/Resources/notes/`.

## Data model

Existing `Note` (Store.swift) is extended, not replaced. Storage stays JSON in `~/Library/Application Support/VoicePet/` (`notes.json` + a directory per note with `mic.caf`, `sys.caf`).

```swift
struct Note {                       // existing fields
  id, date, title, duration, summary, segments: [Segment], speakerNames, status, error
  // new
  var jots: String = ""             // markdown the user typed during the call
  var enhanced: String = ""         // markdown produced by Enhancer
  var template: String = "default"  // template id used for enhanced
  var attendees: [Attendee] = []    // from the calendar event, if any
  var calendarEventID: String? = nil
}
struct Attendee: Codable { var name: String; var email: String? }
```

`status` gains one value: `recording | processing | ready | failed | enhancing`.

Speaker labels stay `me`, `s1`, `s2`… in `segments`; `speakerNames` maps them to display names. Renaming a speaker to an attendee is a `speakerNames` write.

The TypeScript side mirrors this in `src/bridge/types.ts`. Pure edits (rename speaker, edit jots, set template, group segments into turns) live in `features/session/model.ts` as functions, tested with Vitest.

## Bridge contract

Transport: `window.webkit.messageHandlers.ribbit.postMessage(json)` up, `webView.evaluateJavaScript("ribbit.receive(json)")` down. Every message is `{ id, type, payload }`. Commands get a reply with the same `id`; events have no `id`.

Commands (UI → Swift):

| type | payload | reply |
|---|---|---|
| `notes.list` | – | `Note[]` (segments omitted) |
| `notes.get` | `{ id }` | `Note` |
| `notes.update` | `{ id, patch: Partial<Note> }` | `Note` |
| `notes.delete` | `{ id }` | `ok` |
| `session.start` | `{ title?, calendarEventID? }` | `{ noteId }` |
| `session.stop` | – | `ok` |
| `session.status` | – | `{ recording, processing, noteId, elapsed }` |
| `calendar.upcoming` | `{ hours }` | `CalendarEvent[]` |
| `calendar.authorize` | – | `{ granted }` |
| `enhance.run` | `{ id, template }` | `{ enhanced }` |
| `chat.ask` | `{ id, question }` | `{ answer }` |
| `export.copy` | `{ id, what: 'enhanced' \| 'transcript' \| 'jots' }` | `ok` |
| `settings.get` / `settings.set` | `Settings` | `Settings` |
| `window.close` | – | – |

Events (Swift → UI):

| type | payload |
|---|---|
| `session.tick` | `{ noteId, elapsed, level }` once a second |
| `transcript.segment` | `{ noteId, segment }` as LiveTranscriber produces turns |
| `note.updated` | `Note` (status changes, processing done, enhance done) |
| `call.detected` | `{ app, event?: CalendarEvent }` |
| `error` | `{ message }` |

Storybook uses a mock transport (`src/bridge/mock.ts`) that answers from fixtures and can emit scripted events, so every screen story runs without Swift.

## Features

### Library

List of notes newest first, grouped by day. Row: title, date, duration, attendee avatars (initials), status pill (recording / processing / enhancing / failed). Search box filters by title, jots, enhanced text and transcript. Empty state explains the fn / right-click flow and offers "Start a session now".

Detail view has three tabs: **Notes** (enhanced markdown, editable), **Transcript** (turns with speaker chips, click a chip to rename, timestamps), **Jots** (raw). Header: title (editable), date, duration, template picker, Copy menu, Delete.

### Session (during a call)

One screen. Top bar: red dot + elapsed + level meter + Stop. Left 60%: jot pad (plain textarea, markdown, autosaves to `jots` every 2 s and on stop). Right 40%: live transcript feed, auto-scrolls, pauses auto-scroll when the user scrolls up. Speakers show as `Me`, `Speaker 1`… until renamed.

`LiveTranscriber` runs alongside the existing recorder: every 20 s it transcribes the new mic and tap audio since the last cut (reusing `Transcriber.transcribeTimed`), labels mic as `me` and tap audio by a lightweight rule (single remote speaker assumed live; proper diarization still happens on stop via `NoteProcessor`). Live segments are provisional and are replaced by the final pass.

On Stop: the existing pipeline runs (`NoteProcessor.process` → final segments + summary), then `Enhancer.run` with the note's template. UI shows "Processing…" then "Enhancing…" then the Notes tab.

### Enhance

Prompt = template instructions + user jots + transcript. Output is markdown. Templates are markdown files in `Application Support/VoicePet/templates/` with a small frontmatter (`name`, `instructions`); four ship by default: default, one-to-one, customer call, standup. Engine order matches Summarizer: Claude if a key is set, else Apple Intelligence, else a clear error. Re-run is available from the template picker.

### Chat with a note

Input at the bottom of the Notes tab. Question + enhanced notes + transcript go to the same engine as Enhance (Claude or the local Gemma brain via `Brain`). Answers are shown inline, not stored.

### Calendar and call detection

`CalendarSource` uses EventKit (new `NSCalendarsUsageDescription` in Info.plist). Upcoming events within 12 h show as a card at the top of the Library with a "Take notes" button that starts a session pre-filled with title and attendees.

`CallDetector` polls every 5 s: is any input device running somewhere (`kAudioDevicePropertyDeviceIsRunningSomewhere`) while a known call app is running (`us.zoom.xos`, `com.microsoft.teams2`, `com.apple.FaceTime`, `com.tinyspeck.slackmacgap`, plus Chrome/Safari/Arc if a tab title matches `meet.google.com`)? On a rising edge, and if no session is running, Swift emits `call.detected` with the closest calendar event, and the app posts a non-modal prompt (NSPanel near the frog, or the frog says "Take notes?"). Accept → `session.start`. Decline → snooze 10 min for that app. A setting turns detection off per app.

Nothing records without the user pressing Start or accepting the prompt.

### Settings

Speech engine (existing pref), summary/enhance engine + Claude key (existing Keychain item), templates folder, call detection toggles, calendar toggle, "show the frog". Settings are read and written through the bridge to `UserDefaults` / Keychain in Swift.

## Storybook bricks

Story conventions from workout-hub-next: CSF3, `satisfies Meta<typeof X>`, `title: 'Shared/UI/X'` or `'<Feature>/X'`, and a `parameters.docs.description.component` describing the visual layout. Fixtures in `src/fixtures/notes.ts` with three meetings (ready, processing, failed).

| Group | Bricks |
|---|---|
| Shared/UI | Button, IconButton, Chip, SpeakerChip, StatusPill, SearchInput, Tabs, Sheet, Dropdown, EmptyState, LevelMeter, Markdown |
| Brand | Wordmark, Palette |
| Library | NoteRow, NoteList, DayHeader, UpcomingCard, LibraryScreen |
| Session | SessionBar, JotPad, TranscriptTurn, TranscriptFeed, SessionScreen |
| Enhance | TemplatePicker, EnhancedNotes, ChatBox, NoteDetailScreen |
| Settings | SettingsScreen |

Screens are composed of bricks and take a `Bridge` prop; stories pass the mock transport.

## Design tokens

Own palette, documented in `web/notes/DESIGN.md` in the same YAML shape as workout-hub-next. Working direction: near-white canvas, slate ink, one accent (green, a nod to the frog), red only for the recording dot. System font, 14 px body, 12 px labels, tabular numerals for timestamps. Window 960 × 640 default, resizable, minimum 720 × 480.

## Error handling

- System audio tap fails → existing behaviour (mic only) plus a persistent banner in the session screen: "Only recording you. Grant System Audio Recording in System Settings."
- No enhance engine → note stays `ready` with summary only; Notes tab shows the summary and a "Set up an enhance engine" link to Settings.
- Enhance/Claude errors → `note.updated` with `error`, jots and transcript untouched, Retry button.
- Calendar permission denied → upcoming card hidden, Settings shows why.
- Bridge command with unknown type → `error` event, logged with `NSLog`.

## Testing

- `model.ts` edits: Vitest.
- Bricks: Storybook stories are the visual test; a11y addon on.
- Bridge: a TypeScript contract test that every command in `types.ts` has a handler in the mock; Swift side has a switch with `default` that logs, and a unit-ish debug flag `--bridge-selftest` that round-trips every command against the fixtures.
- End to end: record a real call (FaceTime to self or a Meet with a second device) and check live transcript, final diarization, enhance, rename.

## Build phases

Each phase ends with a `./build.sh` that installs and runs.

| Phase | Deliverable |
|---|---|
| 0 | Fork, build vanilla Frog with Xcode 26.6 toolchain (`DEVELOPER_DIR`), record one real call, confirm notes appear |
| 1 | `web/notes` scaffold, tokens, all bricks in Storybook on fixtures |
| 2 | Bridge + NotesWindow; Library and Detail on real notes; SwiftUI NotesView removed |
| 3 | Session screen: jots, LiveTranscriber, Enhancer with templates |
| 4 | CalendarSource + CallDetector prompt; speaker rename from attendees |
| 5 | Chat with a note, export, Settings screen |
| 6 | Polish, `VoicePet Dev` signing, README, release zip |

## Open source and money

Everything in v1 runs on the user's Mac. Licences: Frog MIT, FluidAudio Apache 2, llama.cpp MIT, Parakeet CC-BY 4.0 (attribution in README), Gemma downloaded at runtime under its own terms as Frog does today. Ribbit stays MIT. Users bring their own Claude key if they want it.

A hosted tier (share links, sync, keyless LLM, notarised auto-updates) would cost roughly £3-5 a month to run per user and is not part of this spec. The one fixed cost for a public release is the $99/yr Apple Developer account for notarisation.

## Decisions taken

1. Approach A, bridge as a protocol.
2. Repo `Holzherr/ribbit`, forked from `Pyanov/frog` with `upstream` remote kept for engine fixes. Feature branches, PRs merged fast-forward to `main`.
3. Frog stays, hideable. Bundle id unchanged (`ai.learnvector.voicepet`) until a release, because macOS permissions are keyed on it.
4. Prompt on detected calls, never auto-record.
5. Local enhance by default, Claude optional.
6. Working name "Ribbit". Palette and wordmark decided in phase 1.
