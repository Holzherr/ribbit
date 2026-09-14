import type { Meta, StoryObj } from '@storybook/react-vite';
import { createMockBridge } from '@/bridge/mock';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { useMemo } from 'react';
import { fn } from 'storybook/test';
import { NoteDetailScreen } from './note-detail-screen';

const meta = {
  title: 'Note/NoteDetailScreen',
  component: NoteDetailScreen,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Content pane for one note: header, and Notes / Transcript / Jots tabs. Loads via notes.get and follows note.updated.' } } },
  args: { onBack: fn(), onDeleted: fn() },
} satisfies Meta<typeof NoteDetailScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: { bridge: createMockBridge(FIXTURE_NOTES), id: 'n-ready' },
  render: args => {
    const bridge = useMemo(() => createMockBridge(FIXTURE_NOTES), []);
    return <div className="h-[640px]"><NoteDetailScreen {...args} bridge={bridge} id="n-ready" /></div>;
  },
};

export const Processing: Story = {
  args: { bridge: createMockBridge(FIXTURE_NOTES), id: 'n-processing' },
  render: args => {
    const bridge = useMemo(() => createMockBridge(FIXTURE_NOTES), []);
    return <div className="h-[640px]"><NoteDetailScreen {...args} bridge={bridge} id="n-processing" /></div>;
  },
};

export const Failed: Story = {
  args: { bridge: createMockBridge(FIXTURE_NOTES), id: 'n-failed' },
  render: args => {
    const bridge = useMemo(() => createMockBridge(FIXTURE_NOTES), []);
    return <div className="h-[640px]"><NoteDetailScreen {...args} bridge={bridge} id="n-failed" /></div>;
  },
};
