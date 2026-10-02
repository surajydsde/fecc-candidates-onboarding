import { useMemo, useState } from 'react';
import { Search, ChevronDown, Mail, CalendarDays, Sparkles, X, Users } from 'lucide-react';
import { filterCandidates, STAGES } from '../lib/candidates';
import { formatDate } from '../lib/app';

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'prePending', label: 'Pre pending' },
  { key: 'postPending', label: 'Post pending' },
  { key: 'coursesPending', label: 'Courses pending' },
  { key: 'released', label: 'Released' },
];

const STAGE_STYLES = {
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function StatusDot({ done, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${done ? 'text-emerald-300' : 'text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {label}
    </span>
  );
}

function CandidateCard({ c, onAsk }) {
  const [open, setOpen] = useState(false);
  const stage = STAGES[c.stage];
  const coursesDone = c.requiredCourses.length - c.pendingCourses.length;

  return (
    <li className="bg-[#21222a] border border-slate-700/50 rounded-xl">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-left p-3 cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{c.name}</div>
            <div className="text-[11px] text-slate-500 truncate">
              {c.candidateId}
              {c.department ? ` • ${c.department}` : ''}
              {c.role ? ` • ${c.role}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${STAGE_STYLES[stage.tone]}`}>{stage.short}</span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusDot done={c.preOnboarding} label="Pre" />
          <StatusDot done={c.postOnboarding} label="Post" />
          <StatusDot
            done={c.coursesComplete}
            label={c.requiredCourses.length ? `Courses ${coursesDone}/${c.requiredCourses.length}` : 'Courses'}
          />
          <StatusDot done={c.released} label={c.released ? 'Released' : 'Not released'} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-700/40 pt-2.5 space-y-2 text-xs">
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 break-all">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {c.email}
            </a>
          )}
          {c.joiningDate && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
              Joined {formatDate(c.joiningDate)}
            </div>
          )}
          {c.requiredCourses.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Required courses</div>
              <ul className="space-y-0.5">
                {c.requiredCourses.map((course) => {
                  const pending = c.pendingCourses.includes(course);
                  return (
                    <li key={course} className={`flex items-center gap-1.5 ${pending ? 'text-amber-200' : 'text-slate-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pending ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {course}
                      {pending && <span className="text-[10px] text-amber-400/80">(pending)</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {c.remarks && <p className="text-slate-400 italic">“{c.remarks}”</p>}
          <button
            onClick={() => onAsk(`Give me the full onboarding status of ${c.name} (${c.candidateId}) and what is still pending.`)}
            className="inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            Ask AI about {c.name.split(' ')[0]}
          </button>
        </div>
      )}
    </li>
  );
}

const PAGE = 30;

export function CandidateList({ candidates, departments, filter, onFilter, onAsk }) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => filterCandidates(candidates, { filter, query, department }), [candidates, filter, query, department]);

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-400" />
          Candidates
        </h3>
        <span className="text-[11px] text-slate-500 tabular-nums" aria-live="polite">
          {results.length} of {candidates.length}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search name, ID, email, course"
            aria-label="Search candidates"
            className="w-full bg-[#21222a] border border-slate-700/60 focus:border-indigo-500 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {departments.length > 1 && (
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setLimit(PAGE);
            }}
            aria-label="Filter by department"
            className="bg-[#21222a] border border-slate-700/60 rounded-xl px-2 text-xs text-slate-200 outline-none focus:border-indigo-500 max-w-[38%]"
          >
            <option value="">All depts</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              onFilter(f.key);
              setLimit(PAGE);
            }}
            aria-pressed={filter === f.key}
            className={`shrink-0 px-3 py-1 rounded-full border text-[11px] transition-colors cursor-pointer ${
              filter === f.key ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200' : 'bg-[#21222a] border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">No candidates match.</p>
      ) : (
        <ul className="space-y-2">
          {results.slice(0, limit).map((c) => (
            <CandidateCard key={`${c.candidateId}-${c.row}`} c={c} onAsk={onAsk} />
          ))}
        </ul>
      )}
      {results.length > limit && (
        <button
          onClick={() => setLimit(limit + PAGE)}
          className="w-full py-2 rounded-xl border border-slate-700/60 text-xs text-slate-300 hover:bg-slate-800/60 cursor-pointer"
        >
          Show more ({results.length - limit} left)
        </button>
      )}
    </section>
  );
}
