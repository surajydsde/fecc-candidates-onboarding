import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DashboardView } from '../components/DashboardView';
import { MaterialTopBar } from '../components/MaterialTopBar';
import { validateFile } from '../components/UploadPanel';
import { rowsToCandidates, summarize } from '../lib/candidates';

const { candidates } = rowsToCandidates([
  ['Candidate ID', 'Candidate Name', 'Department', 'Pre Onboarding', 'Post Onboarding', 'Required Courses', 'Completed Courses'],
  ['C1', 'Asha Rao', 'Frontend', 'Yes', 'Yes', 'Security', 'Security'],
  ['C2', 'Ben Dsouza', 'QA', 'Yes', 'No', 'Security', ''],
  ['C3', 'Chitra Iyer', 'QA', 'No', 'No', 'Security', ''],
]);

const upload = { id: 'u1', fileName: 'onboarding.xlsx', uploadedAt: '2026-10-01T10:35:00Z', size: 2048, rowCount: 3, warnings: [] };
const data = {
  active: { ...upload, candidates },
  summary: summarize(candidates),
  uploads: [upload, { ...upload, id: 'u0', fileName: 'older.xlsx', uploadedAt: '2026-09-28T05:00:00Z' }],
  limits: { maxBytes: 3 * 1024 * 1024, extensions: ['.xlsx', '.csv'] },
};

const props = (over = {}) => ({
  data,
  loading: false,
  loadError: null,
  onRetry: vi.fn(),
  isAdmin: false,
  onRequestAdmin: vi.fn(),
  onUpload: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onAskAbout: vi.fn(),
  ...over,
});

describe('DashboardView', () => {
  it('shows the active file, summary and candidates to visitors, without upload controls', () => {
    const p = props();
    render(<DashboardView {...p} />);
    expect(screen.getAllByText('onboarding.xlsx').length).toBeGreaterThan(0);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(screen.queryByTestId('file-input')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete onboarding.xlsx/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Owner sign in'));
    expect(p.onRequestAdmin).toHaveBeenCalled();
  });

  it('lists upload history with date and time, newest marked live', () => {
    render(<DashboardView {...props()} />);
    const history = screen.getByText('Upload history').closest('section');
    expect(within(history).getByText('LIVE')).toBeInTheDocument();
    expect(within(history).getByText('older.xlsx')).toBeInTheDocument();
    const times = history.querySelectorAll('time');
    expect(times[0].getAttribute('datetime')).toBe('2026-10-01T10:35:00Z');
    expect(times[0].textContent).toMatch(/2026/);
  });

  it('filters candidates from the summary cards and chips', () => {
    render(<DashboardView {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pre pending' }));
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Chitra Iyer')).toBeInTheDocument();
    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search candidates'), { target: { value: 'asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('lets the owner upload a file and shows the result', async () => {
    const onUpload = vi.fn().mockResolvedValue({ upload: { ...upload, fileName: 'new.xlsx', rowCount: 40, warnings: ['No "Email" column found.'] } });
    render(<DashboardView {...props({ isAdmin: true, onUpload })} />);
    const file = new File(['data'], 'new.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/new.xlsx uploaded — 40 candidates/)).toBeInTheDocument());
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByText('No "Email" column found.')).toBeInTheDocument();
  });

  it('rejects wrong file types before uploading', async () => {
    const onUpload = vi.fn();
    render(<DashboardView {...props({ isAdmin: true, onUpload })} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [new File(['x'], 'photo.png')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose an Excel (.xlsx) or CSV file.');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('asks before deleting an upload', async () => {
    const onDelete = vi.fn().mockResolvedValue();
    render(<DashboardView {...props({ isAdmin: true, onDelete })} />);
    fireEvent.click(screen.getByLabelText('Delete older.xlsx'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Confirm delete older.xlsx'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'u0' })));
  });

  it('shows an empty state when nothing is uploaded', () => {
    render(<DashboardView {...props({ data: { ...data, active: null, summary: null, uploads: [] } })} />);
    expect(screen.getByText('No candidate sheet yet')).toBeInTheDocument();
  });
});

describe('top bar and file checks', () => {
  it('shows the app name without model or experience labels', () => {
    render(<MaterialTopBar currentTab="chat" onTabChange={vi.fn()} onClearChat={vi.fn()} messageCount={0} onRequestAdmin={vi.fn()} onLockAdmin={vi.fn()} candidateCount={25} />);
    expect(screen.getByRole('heading', { name: 'FECC Candidate Onboarding' })).toBeInTheDocument();
    expect(screen.getByText(/25 candidates/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Gemini|Yrs|Exp/);
  });

  it('validates files on the client', () => {
    expect(validateFile(new File(['x'], 'a.xlsx'))).toBe(null);
    expect(validateFile(new File(['x'], 'a.xls'))).toMatch(/save as .xlsx/);
    expect(validateFile(new File([''], 'a.csv'))).toMatch(/empty/);
    expect(validateFile(new File(['x'], 'a.xlsx'), { maxBytes: 0.5, extensions: ['.xlsx'] })).toMatch(/larger/);
  });
});

import { MessageBubble } from '../components/MessageBubble';
import { cleanSources } from '../lib/api';

describe('answer sources', () => {
  it('shows what the answer was checked against under assistant messages only', () => {
    const sources = [{ label: 'Candidate list', detail: 'pre-onboarding pending · 5 matched' }];
    const { rerender } = render(<MessageBubble message={{ id: 'a', role: 'assistant', text: '5 candidates', timestamp: '10:00', sources }} />);
    expect(screen.getByTestId('answer-sources')).toHaveTextContent('Candidate list · pre-onboarding pending · 5 matched');
    rerender(<MessageBubble message={{ id: 'u', role: 'user', text: 'who?', timestamp: '10:00', sources }} />);
    expect(screen.queryByTestId('answer-sources')).not.toBeInTheDocument();
    rerender(<MessageBubble message={{ id: 'b', role: 'assistant', text: 'Hi', timestamp: '10:00' }} />);
    expect(screen.queryByTestId('answer-sources')).not.toBeInTheDocument();
  });

  it('accepts only well-formed sources from the server', () => {
    expect(cleanSources(null)).toEqual([]);
    expect(cleanSources([{ label: 'A', detail: 'b' }, { detail: 'no label' }, 'junk', { label: 'B', detail: 5 }])).toEqual([
      { label: 'A', detail: 'b' },
      { label: 'B', detail: '' },
    ]);
    expect(cleanSources(Array.from({ length: 10 }, (_, i) => ({ label: `L${i}` })))).toHaveLength(6);
  });
});
