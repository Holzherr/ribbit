import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { expect, fn, userEvent, within } from 'storybook/test';
import { NoteHeader } from './note-header';

const meta = {
  title: 'Note/NoteHeader',
  component: NoteHeader,
  parameters: { docs: { description: { component: 'Top of the detail pane: back arrow, editable title, date · duration · attendees, then Copy and Delete on the right. Delete is two clicks: the trash button becomes a red "Delete?" button for 3 s.' } } },
  args: { onBack: fn(), onTitle: fn(), onCopy: fn(), onDelete: fn() },
} satisfies Meta<typeof NoteHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { note: FIXTURE_NOTES[0]! } };
export const NoAttendees: Story = { args: { note: FIXTURE_NOTES[2]! } };

/** After the first click on the trash button: the "Delete?" confirm button is showing (it reverts after 3 s). */
export const Confirming: Story = {
  args: { note: FIXTURE_NOTES[0]! },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete note' }));
    await expect(canvas.getByRole('button', { name: 'Delete?' })).toBeInTheDocument();
    await expect(args.onDelete).not.toHaveBeenCalled();
  },
};
