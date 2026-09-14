import type { Meta, StoryObj } from '@storybook/react-vite';
import { Wordmark } from './wordmark';

const meta = {
  title: 'Brand/Wordmark',
  component: Wordmark,
  parameters: { docs: { description: { component: 'Text wordmark "ribbit" in brand green with a small dot. Sizes sm (16px) and lg (28px). Placeholder until a mark is drawn.' } } },
} satisfies Meta<typeof Wordmark>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
