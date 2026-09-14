import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SessionBar } from './session-bar';

const meta = {
  title: 'Session/SessionBar',
  component: SessionBar,
  parameters: { docs: { description: { component: 'Recording banner: pulsing red dot, note title, elapsed mm:ss, 5-bar mic level, Stop. Sits above the content pane while a session runs.' } } },
  args: { title: 'Dylan hiring sync', onStop: fn() },
} satisfies Meta<typeof SessionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { elapsed: 754, level: 0.6 } };
export const Quiet: Story = { args: { elapsed: 754, level: 0 } };
