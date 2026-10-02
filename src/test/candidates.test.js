import { describe, it, expect } from 'vitest';
import {
  rowsToCandidates,
  parseStatus,
  formatDate,
  summarize,
  buildDatasetContext,
  filterCandidates,
  mapColumns,
  SheetValidationError,
} from '../lib/candidates';

const HEADER = ['Candidate ID', 'Candidate Name', 'Email', 'Department', 'Pre-Onboarding Checklist', 'Post-Onboarding Checklist', 'Required Courses', 'Completed Courses', 'Release Status'];

const rows = [
  HEADER,
  ['C1', 'Asha Rao', 'asha@example.com', 'Frontend', 'Completed', 'Completed', 'Security; React', 'security;react', 'Released'],
  ['C2', 'Ben Dsouza', '', 'QA', 'Completed', 'Completed', 'Security; Testing', 'Security', 'Not Released'],
  ['C3', 'Chitra Iyer', '', 'QA', 'Done', 'No', 'Security', '', ''],
  ['C4', 'Dev Shah', '', 'Backend', 'Pending', 'Pending', 'Security', '', 'Not Released'],
  ['', '', '', '', '', '', '', '', ''],
];

describe('status parsing', () => {
  it('understands common spellings', () => {
    for (const v of ['Completed', 'complete', 'YES', 'y', 'Done', true, '✓', 'Released']) expect(parseStatus(v)).toBe(true);
    for (const v of ['Pending', 'No', 'In Progress', 'not started', '', false, 'Not Released']) expect(parseStatus(v)).toBe(false);
    expect(parseStatus('maybe')).toBe(null);
  });

  it('formats dates from Date objects, Excel serials and DD/MM/YYYY text', () => {
    expect(formatDate(new Date(Date.UTC(2026, 7, 6)))).toBe('2026-08-06');
    expect(formatDate(46240)).toBe('2026-08-06');
    expect(formatDate('06/08/2026')).toBe('2026-08-06');
    expect(formatDate('2026-08-06T00:00:00Z')).toBe('2026-08-06');
    expect(formatDate('')).toBe('');
  });

  it('matches headers regardless of case, spacing and punctuation', () => {
    const map = mapColumns(['  candidate name ', 'PRE-ONBOARDING', 'Post Onboarding Status', 'DOJ']);
    expect(map).toEqual({ name: 0, preOnboarding: 1, postOnboarding: 2, joiningDate: 3 });
  });
});

describe('rows to candidates', () => {
  const { candidates, warnings } = rowsToCandidates(rows);

  it('skips blank rows and keeps every candidate', () => {
    expect(candidates.map((c) => c.candidateId)).toEqual(['C1', 'C2', 'C3', 'C4']);
  });

  it('works out pending courses case-insensitively', () => {
    expect(candidates[0].pendingCourses).toEqual([]);
    expect(candidates[0].coursesComplete).toBe(true);
    expect(candidates[1].pendingCourses).toEqual(['Testing']);
  });

  it('assigns stages in order: pre → post → courses → released', () => {
    expect(candidates.map((c) => c.stage)).toEqual(['released', 'coursesPending', 'postPending', 'prePending']);
  });

  it('treats course-complete candidates as release candidates (same category)', () => {
    const r = rowsToCandidates([HEADER, ['X', 'Eve', '', '', 'Yes', 'Yes', 'A', 'A', 'Not Released']]);
    expect(r.candidates[0].released).toBe(true);
    expect(r.candidates[0].stage).toBe('released');
  });

  it('flags missing optional columns but not missing values', () => {
    expect(warnings).toEqual([]);
    const r = rowsToCandidates([['Name', 'Pre Onboarding', 'Post Onboarding'], ['Zed', 'maybe', 'Yes']]);
    expect(r.warnings.join(' ')).toMatch(/pre-onboarding value/);
    expect(r.warnings.join(' ')).toMatch(/Required Courses/);
    expect(r.candidates[0].preOnboarding).toBe(false);
  });

  it('rejects sheets without the required columns or rows', () => {
    expect(() => rowsToCandidates([['Name', 'Email'], ['A', 'a@x']])).toThrow(/Pre-Onboarding Checklist, Post-Onboarding Checklist/);
    expect(() => rowsToCandidates([HEADER])).toThrow(SheetValidationError);
    expect(() => rowsToCandidates([])).toThrow(/empty/);
  });

  it('warns about duplicate IDs', () => {
    const r = rowsToCandidates([HEADER, ['D', 'A', '', '', 'Yes', 'Yes', '', '', ''], ['D', 'B', '', '', 'Yes', 'Yes', '', '', '']]);
    expect(r.warnings.join(' ')).toMatch(/Duplicate candidate IDs: D/);
  });
});

describe('summary, AI context and filters', () => {
  const { candidates } = rowsToCandidates(rows);

  it('summarizes counts', () => {
    const s = summarize(candidates);
    expect(s).toMatchObject({ total: 4, preCompleted: 3, postCompleted: 2, coursesCompleted: 1, released: 1 });
    expect(s.stages).toEqual({ prePending: 1, postPending: 1, coursesPending: 1, released: 1 });
    expect(s.pendingByCourse[0]).toEqual({ course: 'Security', count: 2 });
  });

  it('builds AI context with the summary and every candidate', () => {
    const ctx = buildDatasetContext({ fileName: 'list.xlsx', uploadedAt: '2026-10-01T10:00:00Z', candidates });
    expect(ctx).toContain('SOURCE FILE: list.xlsx');
    expect(ctx).toContain('Total candidates: 4');
    expect(ctx).toContain('same category');
    for (const name of ['Asha Rao', 'Ben Dsouza', 'Chitra Iyer', 'Dev Shah']) expect(ctx).toContain(name);
    expect(buildDatasetContext(null)).toMatch(/NO DATA/);
  });

  it('filters by status, department and search text', () => {
    expect(filterCandidates(candidates, { filter: 'prePending' }).map((c) => c.name)).toEqual(['Dev Shah']);
    expect(filterCandidates(candidates, { filter: 'coursesPending' })).toHaveLength(3);
    expect(filterCandidates(candidates, { department: 'QA' })).toHaveLength(2);
    expect(filterCandidates(candidates, { query: 'testing' }).map((c) => c.name)).toEqual(['Ben Dsouza']);
  });
});
