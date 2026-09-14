import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { fn } from 'storybook/test';
import { TranscriptFeed } from './transcript-feed';

const meta = {
  title: 'Note/TranscriptFeed',
  component: TranscriptFeed,
  parameters: { docs: { description: { component: 'Vertical list of transcript turns. Speaker chips are clickable to rename. Shows an empty state when there are no segments.' } } },
  args: { onRenameSpeaker: fn() },
} satisfies Meta<typeof TranscriptFeed>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { note: FIXTURE_NOTES[0]! } };
export const Empty: Story = { args: { note: FIXTURE_NOTES[1]! } };
