import type { Meta, StoryObj } from '@storybook/react-vite';
import { createMockBridge } from '@/bridge/mock';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { useMemo, useState } from 'react';
import { fn } from 'storybook/test';
import { LibraryScreen } from './library-screen';

const meta = {
  title: 'Library/LibraryScreen',
  component: LibraryScreen,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Two-pane window: 280px sidebar (wordmark, Start button, list) and a content pane. Loads notes over the bridge on mount and re-renders on note.updated / note.deleted.' } } },
} satisfies Meta<typeof LibraryScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = { bridge: createMockBridge([]), selectedId: null, onSelect: fn(), onStart: fn(), onSettings: fn() };

export const Default: Story = {
  args: baseArgs,
  render: () => {
    const bridge = useMemo(() => createMockBridge(FIXTURE_NOTES), []);
    const [sel, setSel] = useState<string | null>(null);
    return <LibraryScreen bridge={bridge} selectedId={sel} onSelect={setSel} onStart={fn()} onSettings={fn()} />;
  },
};

export const Empty: Story = {
  args: baseArgs,
  render: () => {
    const bridge = useMemo(() => createMockBridge([]), []);
    const [sel, setSel] = useState<string | null>(null);
    return <LibraryScreen bridge={bridge} selectedId={sel} onSelect={setSel} onStart={fn()} onSettings={fn()} />;
  },
};
