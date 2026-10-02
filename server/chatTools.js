// Tools the AI can call instead of reading the whole sheet.
// The model decides which tool to call; this code runs it over the live dataset and
// returns small, exact results. Counting and filtering happen here, never in the model.
import { summarize, STAGES } from '../src/lib/candidates.js';

export const STATUS_VALUES = [
  'all',
  'pre_pending',
  'pre_completed',
  'post_pending',
  'post_completed',
  'courses_pending',
  'courses_completed',
  'released',
  'not_released',
];
const GROUP_VALUES = ['department', 'stage', 'pending_course', 'role'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export const TOOL_DECLARATIONS = [
  {
    name: 'get_onboarding_summary',
    description:
      'Totals for the live sheet: number of candidates, how many completed or are pending pre-onboarding, post-onboarding and required courses, how many are released, counts per stage, pending candidates per course, and the list of departments. Use for overview and "how many" questions.',
  },
  {
    name: 'list_candidates',
    description:
      'Lists candidates matching filters, with their onboarding status. Use to answer "who" questions. All filters are optional and combine with AND. Returns the exact number matched and up to `limit` rows.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: STATUS_VALUES,
          description:
            'pre_pending / pre_completed = pre-onboarding checklist; post_pending / post_completed = post-onboarding checklist; courses_pending / courses_completed = required courses; released = release candidates (same as course-complete); not_released.',
        },
        department: { type: 'string', description: 'Exact department name, e.g. Frontend.' },
        pending_course: { type: 'string', description: 'Only candidates who still have this required course pending.' },
        search: { type: 'string', description: 'Text to find in name, ID, email, department, role, remarks or pending courses.' },
        limit: { type: 'integer', description: `Rows to return, 1-${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.` },
      },
    },
  },
  {
    name: 'get_candidate',
    description:
      'Full details of one candidate by candidate ID or name (partial names work): email, department, role, joining date, checklist status, required, completed and pending courses, release status and remarks. Returns several matches if the name is ambiguous.',
    parametersJsonSchema: {
      type: 'object',
      properties: { name_or_id: { type: 'string', description: 'Candidate ID (e.g. FECC-1002) or name.' } },
      required: ['name_or_id'],
    },
  },
  {
    name: 'count_candidates',
    description: 'Counts candidates grouped by department, stage, pending course or role, optionally only those with a given status. Use for breakdown and comparison questions.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        group_by: { type: 'string', enum: GROUP_VALUES },
        status: { type: 'string', enum: STATUS_VALUES },
      },
      required: ['group_by'],
    },
  },
];

const lower = (v) => String(v ?? '').trim().toLowerCase();

function matchesStatus(c, status) {
  switch (status) {
    case 'pre_pending':
      return !c.preOnboarding;
    case 'pre_completed':
      return c.preOnboarding;
    case 'post_pending':
      return !c.postOnboarding;
    case 'post_completed':
      return c.postOnboarding;
    case 'courses_pending':
      return !c.coursesComplete;
    case 'courses_completed':
      return c.coursesComplete;
    case 'released':
      return c.released;
    case 'not_released':
      return !c.released;
    default:
      return true;
  }
}

const brief = (c) => ({
  id: c.candidateId,
  name: c.name,
  department: c.department || null,
  role: c.role || null,
  stage: STAGES[c.stage]?.label || c.stage,
  pre_onboarding: c.preOnboarding ? 'Completed' : 'Pending',
  post_onboarding: c.postOnboarding ? 'Completed' : 'Pending',
  pending_courses: c.pendingCourses,
  release_status: c.released ? 'Released' : 'Not Released',
  ...(c.remarks ? { remarks: c.remarks } : {}),
});

const full = (c) => ({
  ...brief(c),
  email: c.email || null,
  joining_date: c.joiningDate || null,
  required_courses: c.requiredCourses,
  completed_courses: c.completedCourses,
});

function badStatus(status) {
  return status !== undefined && !STATUS_VALUES.includes(status);
}

const TOOLS = {
  get_onboarding_summary(_args, dataset) {
    const s = summarize(dataset.candidates);
    return {
      file: dataset.fileName,
      uploaded_at: dataset.uploadedAt,
      total_candidates: s.total,
      pre_onboarding: { completed: s.preCompleted, pending: s.total - s.preCompleted },
      post_onboarding: { completed: s.postCompleted, pending: s.total - s.postCompleted },
      required_courses: { completed: s.coursesCompleted, pending: s.total - s.coursesCompleted },
      released: s.released,
      by_stage: Object.fromEntries(Object.entries(s.stages).map(([k, n]) => [STAGES[k].label, n])),
      pending_by_course: s.pendingByCourse,
      departments: s.departments,
    };
  },

  list_candidates(args, dataset) {
    const { status = 'all', department, pending_course: course, search } = args || {};
    if (badStatus(status)) return { error: `Unknown status "${status}". Use one of: ${STATUS_VALUES.join(', ')}.` };
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(args?.limit, 10) || DEFAULT_LIMIT));
    const q = lower(search);
    const matched = dataset.candidates.filter(
      (c) =>
        matchesStatus(c, status) &&
        (!department || lower(c.department) === lower(department)) &&
        (!course || c.pendingCourses.some((p) => lower(p) === lower(course))) &&
        (!q ||
          [c.name, c.candidateId, c.email, c.department, c.role, c.remarks, ...c.pendingCourses].some((v) => lower(v).includes(q)))
    );
    return {
      matched: matched.length,
      returned: Math.min(limit, matched.length),
      candidates: matched.slice(0, limit).map(brief),
      ...(matched.length > limit ? { note: `Only the first ${limit} of ${matched.length} are listed. Ask for a higher limit to see more.` } : {}),
    };
  },

  get_candidate(args, dataset) {
    const q = lower(args?.name_or_id);
    if (!q) return { error: 'Give a candidate ID or name.' };
    const byId = dataset.candidates.find((c) => lower(c.candidateId) === q);
    if (byId) return { found: 1, candidate: full(byId) };
    const byName = dataset.candidates.filter((c) => lower(c.name) === q);
    const hits = byName.length ? byName : dataset.candidates.filter((c) => lower(c.name).includes(q));
    if (hits.length === 0) return { found: 0, message: `No candidate matches "${args.name_or_id}".` };
    if (hits.length === 1) return { found: 1, candidate: full(hits[0]) };
    return { found: hits.length, message: 'Several candidates match. Ask which one.', matches: hits.slice(0, 10).map((c) => ({ id: c.candidateId, name: c.name, department: c.department || null })) };
  },

  count_candidates(args, dataset) {
    const { group_by: by, status = 'all' } = args || {};
    if (!GROUP_VALUES.includes(by)) return { error: `group_by must be one of: ${GROUP_VALUES.join(', ')}.` };
    if (badStatus(status)) return { error: `Unknown status "${status}". Use one of: ${STATUS_VALUES.join(', ')}.` };
    const rows = dataset.candidates.filter((c) => matchesStatus(c, status));
    const counts = new Map();
    const add = (key) => counts.set(key, (counts.get(key) || 0) + 1);
    for (const c of rows) {
      if (by === 'department') add(c.department || '(none)');
      else if (by === 'role') add(c.role || '(none)');
      else if (by === 'stage') add(STAGES[c.stage]?.label || c.stage);
      else for (const p of c.pendingCourses) add(p);
    }
    return {
      group_by: by,
      status,
      candidates_considered: rows.length,
      groups: [...counts].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
    };
  },
};

/** Runs one tool call from the model. Never throws: errors come back as data the model can read. */
export function runTool(name, args, dataset) {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : null;
  if (!tool) return { error: `Unknown tool "${name}".` };
  try {
    return tool(args || {}, dataset);
  } catch (err) {
    return { error: `The tool failed: ${err?.message || err}` };
  }
}

const STATUS_LABELS = {
  pre_pending: 'pre-onboarding pending',
  pre_completed: 'pre-onboarding completed',
  post_pending: 'post-onboarding pending',
  post_completed: 'post-onboarding completed',
  courses_pending: 'courses pending',
  courses_completed: 'courses completed',
  released: 'released',
  not_released: 'not released',
};
const GROUP_LABELS = { department: 'department', stage: 'stage', pending_course: 'pending course', role: 'role' };
const clip = (v, n = 40) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/**
 * Plain-language record of one tool call, shown under the answer as "Checked: …"
 * so readers can see which data the answer came from. Built from the call and its
 * result on the server; never from model text.
 */
export function describeToolCall(name, args = {}, output = {}) {
  const a = args || {};
  if (output?.error) return { tool: name, label: 'Data check', detail: 'request could not be run' };
  switch (name) {
    case 'get_onboarding_summary':
      return { tool: name, label: 'Onboarding summary', detail: `${output.total_candidates} candidates` };
    case 'list_candidates': {
      const parts = [];
      if (STATUS_LABELS[a.status]) parts.push(STATUS_LABELS[a.status]);
      if (a.department) parts.push(clip(a.department));
      if (a.pending_course) parts.push(`${clip(a.pending_course)} pending`);
      if (a.search) parts.push(`“${clip(a.search, 30)}”`);
      parts.push(`${output.matched} matched`);
      return { tool: name, label: 'Candidate list', detail: parts.join(' · ') };
    }
    case 'get_candidate': {
      const detail =
        output.found === 1 ? output.candidate?.name : output.found > 1 ? `${output.found} possible matches` : `no match for “${clip(a.name_or_id, 30)}”`;
      return { tool: name, label: 'Candidate record', detail };
    }
    case 'count_candidates': {
      const parts = [`by ${GROUP_LABELS[a.group_by] || a.group_by}`];
      if (STATUS_LABELS[a.status]) parts.push(STATUS_LABELS[a.status]);
      parts.push(`${output.candidates_considered} candidates`);
      return { tool: name, label: 'Breakdown', detail: parts.join(' · ') };
    }
    default:
      return { tool: name, label: 'Data check', detail: '' };
  }
}

/** Removes repeated identical checks, keeping first-seen order. */
export function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((s) => {
    const key = `${s.label}|${s.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
