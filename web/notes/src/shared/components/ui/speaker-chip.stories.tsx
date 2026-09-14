import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SpeakerChip } from './speaker-chip';

const meta = {
  title: 'Shared/UI/SpeakerChip',
  component: SpeakerChip,
  parameters: { docs: { description: { component: 'Outlined speaker label tinted by speaker index. Clickable when `onClick` is set (rename).' } } },
} satisfies Meta<typeof SpeakerChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { speaker: 'me', name: 'Me' } };
export const AllSpeakers: Story = {
  args: { speaker: 'me', name: 'Me' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <SpeakerChip speaker="me" name="Me" />
      <SpeakerChip speaker="s1" name="Fiona" />
      <SpeakerChip speaker="s2" name="Dylan" />
      <SpeakerChip speaker="s3" name="Priya" />
      <SpeakerChip speaker="s5" name="Speaker 5" />
      <SpeakerChip speaker="s1" name="Fiona (click to rename)" onClick={fn()} />
    </div>
  ),
};
