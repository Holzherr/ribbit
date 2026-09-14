import type { Preview } from '@storybook/react-vite';
import '../src/styles/tailwind.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
    backgrounds: { options: { app: { name: 'app', value: '#f8fafc' }, white: { name: 'white', value: '#ffffff' } } },
    viewport: { options: { window: { name: 'Notes window', styles: { width: '960px', height: '640px' }, type: 'desktop' } } },
  },
  initialGlobals: { backgrounds: { value: 'app' } },
};
export default preview;
