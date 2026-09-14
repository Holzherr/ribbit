import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchInput } from './search-input';

const meta = {
  title: 'Shared/UI/SearchInput',
  component: SearchInput,
  parameters: { docs: { description: { component: 'Rounded search field with a leading magnifier and a clear button when non-empty. 32px high.' } } },
} satisfies Meta<typeof SearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: '', onChange: () => {} },
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-72 p-6">
        <SearchInput value={value} onChange={setValue} />
      </div>
    );
  },
};
