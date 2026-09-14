import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText } from 'lucide-react';
import { Button } from './button';
import { EmptyState } from './empty-state';

const meta = {
  title: 'Shared/UI/EmptyState',
  component: EmptyState,
  parameters: { docs: { description: { component: 'Centred icon, title, one-line body and an optional action. Used when a list or a tab is empty.' } } },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <FileText />,
    title: 'No notes yet',
    body: 'Start a session before a call and both sides land here.',
    action: <Button>Start a session</Button>,
  },
};
