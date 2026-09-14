import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Brand/Palette',
  parameters: { docs: { description: { component: 'Grid of every colour token defined in DESIGN.md / tailwind.css, with the token name shown under each swatch.' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const tokens = [
  'bg-brand', 'bg-brand-soft', 'bg-ink', 'bg-body', 'bg-muted', 'bg-faint',
  'bg-line', 'bg-line-soft', 'bg-surface', 'bg-canvas', 'bg-well',
  'bg-rec', 'bg-rec-soft', 'bg-danger', 'bg-warn', 'bg-warn-soft',
];

export const AllTokens: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-6">
      {tokens.map(t => (
        <div key={t} className="flex flex-col items-center gap-2">
          <div className={`size-16 rounded-card border border-line ${t}`} />
          <span className="text-[12px] text-muted">{t}</span>
        </div>
      ))}
    </div>
  ),
};
