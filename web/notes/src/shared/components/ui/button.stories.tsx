import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mic, Square } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Shared/UI/Button',
  component: Button,
  parameters: { docs: { description: { component: 'Rounded 32px-high button. Variants: brand (green fill, the one primary action per screen), ghost (white with border), soft (grey fill), text (green text), danger (red text), quiet (grey text). Sizes: default, sm, icon, icon-sm. `block` stretches full width.' } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'brand', children: <><Mic /> Start notes</> } };
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Button variant="brand"><Mic /> Start</Button>
      <Button variant="ghost"><Square /> Stop</Button>
      <Button variant="soft">Copy</Button>
      <Button variant="text">Enhance again</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="quiet">Cancel</Button>
      <Button size="sm">Small</Button>
    </div>
  ),
};
