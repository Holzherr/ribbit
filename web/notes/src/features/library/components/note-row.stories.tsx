import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { fn } from 'storybook/test';
import { NoteRow } from './note-row';

const [ready, processing, failed] = FIXTURE_NOTES;

const meta = {
  title: 'Library/NoteRow',
  component: NoteRow,
  parameters: { docs: { description: { component: 'One note in the sidebar list: title, time · duration, up to three attendee initials, and a status pill. The selected row gets a well background.' } } },
  decorators: [Story => <div className="w-[280px] p-1"><Story /></div>],
  args: { onSelect: fn() },
} satisfies Meta<typeof NoteRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { note: ready! } };
export const Processing: Story = { args: { note: processing! } };
export const Failed: Story = { args: { note: failed! } };
export const Selected: Story = { args: { note: ready!, selected: true } };
