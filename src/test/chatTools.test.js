// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseSheet } from '../../server/excel.js';
import { runTool, TOOL_DECLARATIONS, STATUS_VALUES } from '../../server/chatTools.js';

const parsed = await parseSheet(fs.readFileSync('public/sample/fecc-candidates-sample.xlsx'), 'sample.xlsx');
const dataset = { fileName: 'sample.xlsx', uploadedAt: '2026-10-01T10:00:00Z', rowCount: parsed.candidates.length, candidates: parsed.candidates };
const run = (name, args) => runTool(name, args, dataset);

describe('chat tools on the sample sheet', () => {
  it('summary returns exact totals', () => {
    const s = run('get_onboarding_summary');
    expect(s).toMatchObject({
      total_candidates: 25,
      pre_onboarding: { completed: 20, pending: 5 },
      post_onboarding: { completed: 15, pending: 10 },
      required_courses: { completed: 8, pending: 17 },
      released: 8,
    });
    expect(s.pending_by_course[0]).toEqual({ course: 'Data Privacy Fundamentals', count: 14 });
  });

  it('lists by status, department, pending course and search', () => {
    expect(run('list_candidates', { status: 'pre_pending' }).matched).toBe(5);
    expect(run('list_candidates', { status: 'released', department: 'frontend' }).candidates.map((c) => c.name)).toEqual([
      'Aarav Sharma',
      'Sneha Kulkarni',
      'Rahul Verma',
    ]);
    expect(run('list_candidates', { pending_course: 'data privacy fundamentals' }).matched).toBe(14);
    expect(run('list_candidates', { search: 'ready for allocation' }).candidates.map((c) => c.name)).toEqual(['Karan Patel', 'Tanvi Shah']);
  });

  it('limits rows but always reports the full match count', () => {
    const r = run('list_candidates', { status: 'courses_pending', limit: 5 });
    expect(r).toMatchObject({ matched: 17, returned: 5 });
    expect(r.note).toMatch(/first 5 of 17/);
    expect(run('list_candidates', { limit: 999 }).returned).toBe(25);
  });

  it('keeps emails out of lists but includes them in one candidate', () => {
    expect(run('list_candidates', {}).candidates[0].email).toBeUndefined();
    const one = run('get_candidate', { name_or_id: 'FECC-1002' });
    expect(one.candidate).toMatchObject({ name: 'Priya Nair', email: 'priya.nair@example.com', pending_courses: ['Data Privacy Fundamentals', 'Node.js Fundamentals'] });
  });

  it('finds candidates by partial name and reports ambiguity', () => {
    expect(run('get_candidate', { name_or_id: 'vikram' }).candidate.name).toBe('Vikram Singh');
    const many = run('get_candidate', { name_or_id: 'an' });
    expect(many.found).toBeGreaterThan(1);
    expect(many.matches.length).toBeLessThanOrEqual(10);
    expect(run('get_candidate', { name_or_id: 'nobody' }).found).toBe(0);
  });

  it('counts by group', () => {
    const byDept = run('count_candidates', { group_by: 'department', status: 'released' });
    expect(byDept.candidates_considered).toBe(8);
    expect(byDept.groups.reduce((n, g) => n + g.count, 0)).toBe(8);
    expect(run('count_candidates', { group_by: 'stage' }).groups.reduce((n, g) => n + g.count, 0)).toBe(25);
  });

  it('returns errors as data instead of throwing', () => {
    expect(run('list_candidates', { status: 'weird' }).error).toMatch(/Unknown status/);
    expect(run('count_candidates', { group_by: 'salary' }).error).toMatch(/group_by/);
    expect(run('drop_tables', {}).error).toMatch(/Unknown tool/);
    expect(run('constructor', {}).error).toMatch(/Unknown tool/);
  });

  it('declares every status the code understands', () => {
    const list = TOOL_DECLARATIONS.find((t) => t.name === 'list_candidates');
    expect(list.parametersJsonSchema.properties.status.enum).toEqual(STATUS_VALUES);
  });
});

import { describeToolCall, uniqueSources } from '../../server/chatTools.js';

describe('Checked line descriptions', () => {
  const describeRun = (name, args) => describeToolCall(name, args, run(name, args));

  it('describes each tool in plain words with exact numbers', () => {
    expect(describeRun('get_onboarding_summary', {})).toMatchObject({ label: 'Onboarding summary', detail: '25 candidates' });
    expect(describeRun('list_candidates', { status: 'released', department: 'Frontend' })).toMatchObject({
      label: 'Candidate list',
      detail: 'released · Frontend · 3 matched',
    });
    expect(describeRun('list_candidates', { pending_course: 'Data Privacy Fundamentals' }).detail).toBe('Data Privacy Fundamentals pending · 14 matched');
    expect(describeRun('get_candidate', { name_or_id: 'FECC-1002' })).toMatchObject({ label: 'Candidate record', detail: 'Priya Nair' });
    expect(describeRun('get_candidate', { name_or_id: 'nobody' }).detail).toBe('no match for “nobody”');
    expect(describeRun('count_candidates', { group_by: 'department', status: 'released' }).detail).toBe('by department · released · 8 candidates');
  });

  it('reports failed requests without inventing numbers', () => {
    expect(describeRun('list_candidates', { status: 'weird' })).toMatchObject({ label: 'Data check', detail: 'request could not be run' });
  });

  it('removes duplicates and keeps order', () => {
    const a = { label: 'Candidate list', detail: 'x' };
    const b = { label: 'Breakdown', detail: 'y' };
    expect(uniqueSources([a, b, { ...a }])).toEqual([a, b]);
  });
});
