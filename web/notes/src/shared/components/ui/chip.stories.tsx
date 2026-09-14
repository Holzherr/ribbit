import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './chip';

const meta = {
  title: 'Shared/UI/Chip',
  component: Chip,
  parameters: { docs: { description: { component: 'Small rounded label. 20px high, 12px text.' } } },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { tone: 'neutral', children: 'Draft' } };
export const AllTones: Story = {
  args: { children: 'Chip' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Chip tone="neutral">Neutral</Chip>
      <Chip tone="brand">Brand</Chip>
      <Chip tone="rec">Rec</Chip>
    </div>
  ),
};
