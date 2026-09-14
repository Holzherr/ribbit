import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { useState } from 'react';
import { NoteList } from './note-list';

const meta = {
  title: 'Library/NoteList',
  component: NoteList,
  parameters: { docs: { description: { component: 'Sidebar: search box on top, then rows grouped by day label. Shows an empty state when nothing matches the search, or when there are no notes at all.' } } },
} satisfies Meta<typeof NoteList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { notes: FIXTURE_NOTES, query: '', onQuery: () => {}, onSelect: () => {} },
  render: () => {
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    return (
      <div className="h-[480px] w-[280px] border border-line">
        <NoteList notes={FIXTURE_NOTES} selectedId={selectedId} onSelect={setSelectedId} query={query} onQuery={setQuery} />
      </div>
    );
  },
};

export const Empty: Story = {
  args: { notes: [], query: '', onQuery: () => {}, onSelect: () => {} },
  render: () => (
    <div className="h-[480px] w-[280px] border border-line">
      <NoteList notes={[]} selectedId={null} onSelect={() => {}} query="" onQuery={() => {}} />
    </div>
  ),
};
