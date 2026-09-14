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
