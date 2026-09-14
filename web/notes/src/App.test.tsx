import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createMockBridge } from '@/bridge/mock';
import { FIXTURE_NOTES } from '@/fixtures/notes';
import { App } from './App';

describe('App session bar', () => {
  it('shows live elapsed while recording and clears once the note leaves recording', async () => {
    const bridge = createMockBridge(FIXTURE_NOTES);
    render(<App bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /start notes/i }));
    await waitFor(() => expect(bridge.notes.some(n => n.status === 'recording')).toBe(true));
    const noteId = bridge.notes.find(n => n.status === 'recording')!.id;

    act(() => { bridge.emit('session.tick', { noteId, elapsed: 754, level: 0.6 }); });
    expect(await screen.findByText('12:34')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(screen.queryByText('12:34')).not.toBeInTheDocument());
  });

  it('shows an error and no session bar when Start is rejected because the last note is still processing', async () => {
    const bridge = createMockBridge(FIXTURE_NOTES);
    render(<App bridge={bridge} />);

    fireEvent.click(screen.getByRole('button', { name: /start notes/i }));
    await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /start notes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't start: still processing the last note");
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    expect(bridge.notes.some(n => n.status === 'recording')).toBe(false);
  });
});

describe('App note deletion', () => {
  it('removes the row and clears the detail pane when a note.deleted event arrives', async () => {
    const bridge = createMockBridge(FIXTURE_NOTES);
    render(<App bridge={bridge} />);

    fireEvent.click(await screen.findByText('Cat sitter marketplace kickoff'));
    expect(await screen.findByDisplayValue('Cat sitter marketplace kickoff')).toBeInTheDocument();

    act(() => { bridge.emit('note.deleted', { id: 'n-ready' }); });
    expect(await screen.findByText('Pick a note')).toBeInTheDocument();
    expect(screen.queryByText('Cat sitter marketplace kickoff')).not.toBeInTheDocument();
    expect(screen.getByText('Dylan hiring sync')).toBeInTheDocument();
  });

  it('deletes only after the confirm click and drops the note from the sidebar', async () => {
    const bridge = createMockBridge(FIXTURE_NOTES);
    render(<App bridge={bridge} />);

    fireEvent.click(await screen.findByText('Cat sitter marketplace kickoff'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
    expect(bridge.notes.some(n => n.id === 'n-ready')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Delete?' }));
    await waitFor(() => expect(screen.queryByText('Cat sitter marketplace kickoff')).not.toBeInTheDocument());
    expect(bridge.notes.some(n => n.id === 'n-ready')).toBe(false);
    expect(screen.getByText('Pick a note')).toBeInTheDocument();
  });
});
