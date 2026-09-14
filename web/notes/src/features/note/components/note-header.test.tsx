import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { NoteHeader } from './note-header';

const renderHeader = (onDelete = vi.fn()) => {
  render(<NoteHeader note={FIXTURE_NOTES[0]!} onTitle={vi.fn()} onCopy={vi.fn()} onDelete={onDelete} />);
  return onDelete;
};

describe('NoteHeader delete', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('asks for confirmation before deleting', () => {
    const onDelete = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete?' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('falls back to the trash button after 3 seconds without a second click', () => {
    const onDelete = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(screen.getByRole('button', { name: 'Delete?' })).toHaveTextContent('Delete?');

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByRole('button', { name: 'Delete?' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
