import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { fn } from 'storybook/test';
import { NoteHeader } from './note-header';

const meta = {
  title: 'Note/NoteHeader',
  component: NoteHeader,
  parameters: { docs: { description: { component: 'Top of the detail pane: back arrow, editable title, date · duration · attendees, then Copy and Delete on the right.' } } },
  args: { onBack: fn(), onTitle: fn(), onCopy: fn(), onDelete: fn() },
} satisfies Meta<typeof NoteHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { note: FIXTURE_NOTES[0]! } };
export const NoAttendees: Story = { args: { note: FIXTURE_NOTES[2]! } };
