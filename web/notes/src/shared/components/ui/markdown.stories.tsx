import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { Markdown } from './markdown';

const meta = {
  title: 'Shared/UI/Markdown',
  component: Markdown,
  parameters: { docs: { description: { component: 'Renders the markdown subset the summarizer and enhancer produce: #, ## headings, - bullets, **bold**, paragraphs. Text only, no HTML.' } } },
} satisfies Meta<typeof Markdown>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { source: FIXTURE_NOTES[0]!.enhanced },
  render: () => (
    <div className="max-w-xl p-6">
      <Markdown source={FIXTURE_NOTES[0]!.enhanced} />
    </div>
  ),
};
