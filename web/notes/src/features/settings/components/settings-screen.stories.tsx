import type { Meta, StoryObj } from '@storybook/react-vite';
import { createMockBridge } from '@/bridge/mock';
import { useMemo } from 'react';
import { fn } from 'storybook/test';
import { SettingsScreen } from './settings-screen';

const meta = {
  title: 'Settings/SettingsScreen',
  component: SettingsScreen,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Content pane, centred column up to 576px: back button and "Settings" heading, then rows (label and hint on the left, control on the right) for speech engine and notes writer as segmented choices, and a show-the-frog checkbox. Loads settings.get on mount and writes settings.set on each change.' } } },
  args: { bridge: createMockBridge([]), onBack: fn() },
} satisfies Meta<typeof SettingsScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => {
    const bridge = useMemo(() => createMockBridge([]), []);
    return <SettingsScreen {...args} bridge={bridge} />;
  },
};
