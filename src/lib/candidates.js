// Shared candidate-data logic used by the server (parsing uploads, building AI context)
// and the browser (summary cards, filters). Pure functions only, no I/O.

/** Column aliases. Headers are matched case-insensitively, ignoring spaces and punctuation. */
export const COLUMN_ALIASES = {
  candidateId: ['candidateid', 'id', 'empid', 'employeeid', 'employeeno', 'empno', 'candidateno'],
  name: ['candidatename', 'name', 'fullname', 'employeename'],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  department: ['department', 'dept', 'team', 'unit', 'practice'],
  role: ['role', 'designation', 'position', 'title'],
  joiningDate: ['joiningdate', 'dateofjoining', 'doj', 'startdate', 'joindate'],
  preOnboarding: ['preonboarding', 'preonboardingchecklist', 'preonboardingstatus', 'preonboardingcompleted'],
  postOnboarding: ['postonboarding', 'postonboardingchecklist', 'postonboardingstatus', 'postonboardingcompleted'],
  requiredCourses: ['requiredcourses', 'mandatorycourses', 'requiredtrainings', 'mandatorytrainings'],
  completedCourses: ['completedcourses', 'coursescompleted', 'completedtrainings', 'trainingscompleted'],
  courseStatus: ['coursestatus', 'trainingstatus', 'coursecompletion', 'coursecompletionstatus'],
  releaseStatus: ['releasestatus', 'release', 'released', 'releasecandidate'],
  remarks: ['remarks', 'notes', 'comments', 'comment'],
};

export const REQUIRED_COLUMNS = ['name', 'preOnboarding', 'postOnboarding'];

export const COLUMN_LABELS = {
  candidateId: 'Candidate ID',
  name: 'Candidate Name',
  email: 'Email',
  department: 'Department',
  role: 'Role',
  joiningDate: 'Joining Date',
  preOnboarding: 'Pre-Onboarding Checklist',
  postOnboarding: 'Post-Onboarding Checklist',
  requiredCourses: 'Required Courses',
  completedCourses: 'Completed Courses',
  courseStatus: 'Course Status',
  releaseStatus: 'Release Status',
  remarks: 'Remarks',
};

/**
 * Onboarding stage, in order. Per the business rule, release candidates and
 * course-complete candidates are the same category ("released").
 */
export const STAGES = {
  prePending: { key: 'prePending', label: 'Pre-onboarding pending', short: 'Pre pending', tone: 'amber' },
  postPending: { key: 'postPending', label: 'Post-onboarding pending', short: 'Post pending', tone: 'sky' },
  coursesPending: { key: 'coursesPending', label: 'Courses pending', short: 'Courses pending', tone: 'violet' },
  released: { key: 'released', label: 'Released / course complete', short: 'Released', tone: 'emerald' },
};

export const MAX_CANDIDATES = 5000;
const MAX_TEXT = 300;

export class SheetValidationError extends Error {}

export function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Maps a header row to { field: columnIndex }. Unknown headers are ignored. */
export function mapColumns(headers) {
  const lookup = new Map();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) lookup.set(alias, field);
  }
  const map = {};
  headers.forEach((header, index) => {
    const field = lookup.get(normalizeHeader(header));
    if (field && map[field] === undefined) map[field] = index;
  });
  return map;
}

function text(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

const YES = new Set(['completed', 'complete', 'done', 'yes', 'y', 'true', '1', 'released', 'cleared', 'closed', '✓', '✔', 'x']);
const NO = new Set(['pending', 'notcompleted', 'incomplete', 'no', 'n', 'false', '0', 'inprogress', 'notstarted', 'notreleased', 'open', 'onhold', '']);

/** Returns true/false for recognised status text, or null if the value is unrecognised. */
export function parseStatus(value) {
  if (typeof value === 'boolean') return value;
  const key = normalizeHeader(value);
  if (YES.has(key) || YES.has(String(value ?? '').trim())) return true;
  if (NO.has(key)) return false;
  return null;
}

export function splitList(value) {
  return text(value, 2000)
    .split(/[;,|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Formats a spreadsheet date (Date, Excel serial number or string) as YYYY-MM-DD. */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number' && value > 20000 && value < 80000) {
    date = new Date(Math.round((value - 25569) * 86400 * 1000)); // Excel serial → UTC
  } else {
    const s = text(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // Indian style DD/MM/YYYY
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return s;
  }
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sameCourse(a, b) {
  return normalizeHeader(a) === normalizeHeader(b);
}

/** Works out the stage for a candidate from their checklist and course data. */
export function stageFor({ preOnboarding, postOnboarding, coursesComplete, released }) {
  if (!preOnboarding) return 'prePending';
  if (!postOnboarding) return 'postPending';
  if (coursesComplete || released) return 'released';
  return 'coursesPending';
}

/**
 * Turns raw sheet rows (arrays of cell values, first row = headers) into candidates.
 * Throws SheetValidationError with a readable message when the sheet can't be used.
 */
export function rowsToCandidates(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new SheetValidationError('The sheet is empty.');
  }
  const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => text(cell)));
  if (headerIndex === -1) throw new SheetValidationError('The sheet is empty.');

  const columns = mapColumns(rows[headerIndex]);
  const missing = REQUIRED_COLUMNS.filter((field) => columns[field] === undefined);
  if (missing.length) {
    throw new SheetValidationError(
      `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map((f) => COLUMN_LABELS[f]).join(', ')}. ` +
        'Download the sample sheet to see the expected format.'
    );
  }

  const warnings = [];
  const unrecognised = { pre: 0, post: 0, release: 0 };
  const candidates = [];
  const cell = (row, field) => (columns[field] === undefined ? undefined : row[columns[field]]);

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || !row.some((c) => text(c))) continue;

    const name = text(cell(row, 'name'), 120);
    if (!name) {
      warnings.push(`Row ${i + 1} skipped: no candidate name.`);
      continue;
    }
    if (candidates.length >= MAX_CANDIDATES) {
      throw new SheetValidationError(`The sheet has more than ${MAX_CANDIDATES} candidates. Please split it into smaller files.`);
    }

    const pre = parseStatus(cell(row, 'preOnboarding'));
    const post = parseStatus(cell(row, 'postOnboarding'));
    if (pre === null) unrecognised.pre++;
    if (post === null) unrecognised.post++;

    const requiredCourses = splitList(cell(row, 'requiredCourses'));
    const completedCourses = splitList(cell(row, 'completedCourses'));
    const pendingCourses = requiredCourses.filter((r) => !completedCourses.some((c) => sameCourse(c, r)));

    let coursesComplete;
    if (columns.requiredCourses !== undefined && requiredCourses.length) {
      coursesComplete = pendingCourses.length === 0;
    } else if (columns.courseStatus !== undefined) {
      coursesComplete = parseStatus(cell(row, 'courseStatus')) === true;
    } else {
      coursesComplete = false;
    }

    let released = coursesComplete;
    if (columns.releaseStatus !== undefined) {
      const parsed = parseStatus(cell(row, 'releaseStatus'));
      if (parsed === null && text(cell(row, 'releaseStatus'))) unrecognised.release++;
      // Release candidates and course-complete candidates are the same category.
      released = parsed === true || coursesComplete;
    }

    const candidate = {
      row: i + 1,
      candidateId: text(cell(row, 'candidateId'), 40) || `ROW-${i + 1}`,
      name,
      email: text(cell(row, 'email'), 160),
      department: text(cell(row, 'department'), 80),
      role: text(cell(row, 'role'), 80),
      joiningDate: formatDate(cell(row, 'joiningDate')),
      preOnboarding: pre === true,
      postOnboarding: post === true,
      requiredCourses,
      completedCourses,
      pendingCourses,
      coursesComplete,
      released,
      remarks: text(cell(row, 'remarks')),
    };
    candidate.stage = stageFor(candidate);
    candidates.push(candidate);
  }

  if (candidates.length === 0) throw new SheetValidationError('No candidate rows found under the header row.');

  if (unrecognised.pre) warnings.push(`${unrecognised.pre} pre-onboarding value(s) weren't recognised and were treated as pending.`);
  if (unrecognised.post) warnings.push(`${unrecognised.post} post-onboarding value(s) weren't recognised and were treated as pending.`);
  if (unrecognised.release) warnings.push(`${unrecognised.release} release status value(s) weren't recognised and were treated as not released.`);
  for (const field of ['requiredCourses', 'releaseStatus', 'email']) {
    if (columns[field] === undefined) warnings.push(`No "${COLUMN_LABELS[field]}" column found.`);
  }

  const ids = new Map();
  for (const c of candidates) ids.set(c.candidateId, (ids.get(c.candidateId) || 0) + 1);
  const dupes = [...ids].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupes.length) warnings.push(`Duplicate candidate IDs: ${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? '…' : ''}`);

  return {
    candidates,
    columns: Object.keys(columns).map((field) => COLUMN_LABELS[field]),
    warnings: warnings.slice(0, 20),
  };
}

export function summarize(candidates = []) {
  const total = candidates.length;
  const count = (fn) => candidates.reduce((n, c) => n + (fn(c) ? 1 : 0), 0);
  const stages = Object.fromEntries(Object.keys(STAGES).map((key) => [key, count((c) => c.stage === key)]));
  const courseCounts = new Map();
  for (const c of candidates) {
    for (const course of c.pendingCourses || []) courseCounts.set(course, (courseCounts.get(course) || 0) + 1);
  }
  return {
    total,
    preCompleted: count((c) => c.preOnboarding),
    postCompleted: count((c) => c.postOnboarding),
    coursesCompleted: count((c) => c.coursesComplete),
    released: count((c) => c.released),
    stages,
    pendingByCourse: [...courseCounts].sort((a, b) => b[1] - a[1]).map(([course, n]) => ({ course, count: n })),
    departments: [...new Set(candidates.map((c) => c.department).filter(Boolean))].sort(),
  };
}

export function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

const yn = (v) => (v ? 'Completed' : 'Pending');

/** Compact, line-per-candidate text the AI answers from. */
export function buildDatasetContext(dataset) {
  if (!dataset || !dataset.candidates?.length) return 'NO DATA: no candidate sheet has been uploaded yet.';
  const s = summarize(dataset.candidates);
  const lines = [
    `SOURCE FILE: ${dataset.fileName}`,
    `UPLOADED AT: ${dataset.uploadedAt}`,
    '',
    'SUMMARY',
    `Total candidates: ${s.total}`,
    `Pre-onboarding checklist completed: ${s.preCompleted} (pending ${s.total - s.preCompleted})`,
    `Post-onboarding checklist completed: ${s.postCompleted} (pending ${s.total - s.postCompleted})`,
    `All required courses completed: ${s.coursesCompleted} (pending ${s.total - s.coursesCompleted})`,
    `Release candidates (released / course complete, same category): ${s.released}`,
    `By stage: ${Object.entries(s.stages)
      .map(([k, n]) => `${STAGES[k].label} ${n}`)
      .join('; ')}`,
  ];
  if (s.pendingByCourse.length) {
    lines.push(`Candidates pending per course: ${s.pendingByCourse.map((p) => `${p.course} ${p.count}`).join('; ')}`);
  }
  if (s.departments.length) lines.push(`Departments: ${s.departments.join(', ')}`);
  lines.push(
    '',
    'CANDIDATES (one per line, fields separated by " | ")',
    'ID | Name | Email | Department | Role | Joining Date | Pre-Onboarding | Post-Onboarding | Required Courses | Completed Courses | Pending Courses | Release Status | Stage | Remarks'
  );
  for (const c of dataset.candidates) {
    lines.push(
      [
        c.candidateId,
        c.name,
        c.email || '-',
        c.department || '-',
        c.role || '-',
        c.joiningDate || '-',
        yn(c.preOnboarding),
        yn(c.postOnboarding),
        c.requiredCourses.join('; ') || '-',
        c.completedCourses.join('; ') || '-',
        c.pendingCourses.join('; ') || 'None',
        c.released ? 'Released' : 'Not Released',
        STAGES[c.stage]?.label || c.stage,
        c.remarks || '-',
      ].join(' | ')
    );
  }
  return lines.join('\n');
}

/** Filters candidates by stage/status filter and free-text search. */
export function filterCandidates(candidates, { filter = 'all', query = '', department = '' } = {}) {
  const q = query.trim().toLowerCase();
  return candidates.filter((c) => {
    if (department && c.department !== department) return false;
    if (filter === 'prePending' && c.preOnboarding) return false;
    if (filter === 'postPending' && c.postOnboarding) return false;
    if (filter === 'coursesPending' && c.coursesComplete) return false;
    if (filter === 'released' && !c.released) return false;
    if (!q) return true;
    return [c.name, c.candidateId, c.email, c.department, c.role, ...c.pendingCourses].some((v) =>
      String(v || '').toLowerCase().includes(q)
    );
  });
}
