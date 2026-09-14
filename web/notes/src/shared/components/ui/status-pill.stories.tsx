import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusPill } from './status-pill';

const meta = {
  title: 'Shared/UI/StatusPill',
  component: StatusPill,
  parameters: { docs: { description: { component: "Chip for a note's status. Renders nothing for `ready`. Recording shows a pulsing red dot." } } },
} satisfies Meta<typeof StatusPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { status: 'recording' } };
export const AllStatuses: Story = {
  args: { status: 'ready' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <StatusPill status="ready" />
      <span className="text-[12px] text-muted">(ready renders nothing)</span>
      <StatusPill status="recording" />
      <StatusPill status="processing" />
      <StatusPill status="enhancing" />
      <StatusPill status="failed" />
    </div>
  ),
};
