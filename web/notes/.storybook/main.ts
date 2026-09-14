import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  // Storybook reuses vite.config.ts; the singlefile plugin must not run there.
  viteFinal: config => ({ ...config, base: './', plugins: (config.plugins ?? []).flat().filter(p => !(p && typeof p === 'object' && 'name' in p && String((p as { name: string }).name).includes('singlefile'))) }),
};
export default config;
