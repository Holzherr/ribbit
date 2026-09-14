import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Tabs } from './tabs';

const meta = {
  title: 'Shared/UI/Tabs',
  component: Tabs,
  parameters: { docs: { description: { component: 'Underlined tab strip. The active tab has an ink underline; others are muted.' } } },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { id: 'notes', label: 'Notes' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'jots', label: 'Jots' },
];

export const Default: Story = {
  args: { items, value: 'notes', onChange: () => {} },
  render: () => {
    const [value, setValue] = useState('notes');
    return (
      <div className="w-96 p-6">
        <Tabs items={items} value={value} onChange={setValue} />
      </div>
    );
  },
};
