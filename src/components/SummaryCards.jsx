import { ClipboardList, ClipboardCheck, GraduationCap, Rocket } from 'lucide-react';
import { percent } from '../lib/candidates';

const TONES = {
  amber: { icon: 'text-amber-400', bar: 'bg-amber-400', ring: 'border-amber-500/50 bg-amber-950/20' },
  sky: { icon: 'text-sky-400', bar: 'bg-sky-400', ring: 'border-sky-500/50 bg-sky-950/20' },
  violet: { icon: 'text-violet-400', bar: 'bg-violet-400', ring: 'border-violet-500/50 bg-violet-950/20' },
  emerald: { icon: 'text-emerald-400', bar: 'bg-emerald-400', ring: 'border-emerald-500/50 bg-emerald-950/20' },
};

/** Each card shows completed / total; tapping it filters the list to the candidates still pending (or released). */
export function SummaryCards({ summary, activeFilter, onFilter }) {
  const { total } = summary;
  const cards = [
    { key: 'prePending', label: 'Pre-onboarding', done: summary.preCompleted, icon: ClipboardList, tone: 'amber', pendingLabel: 'pending' },
    { key: 'postPending', label: 'Post-onboarding', done: summary.postCompleted, icon: ClipboardCheck, tone: 'sky', pendingLabel: 'pending' },
    { key: 'coursesPending', label: 'Required courses', done: summary.coursesCompleted, icon: GraduationCap, tone: 'violet', pendingLabel: 'pending' },
    { key: 'released', label: 'Release candidates', done: summary.released, icon: Rocket, tone: 'emerald', pendingLabel: 'not released' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map(({ key, label, done, icon: Icon, tone, pendingLabel }) => {
        const t = TONES[tone];
        const active = activeFilter === key;
        const pct = percent(done, total);
        return (
          <button
            key={key}
            onClick={() => onFilter(active ? 'all' : key)}
            aria-pressed={active}
            className={`text-left p-3 rounded-2xl border transition-colors cursor-pointer ${
              active ? t.ring : 'bg-[#21222a] border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Icon className={`w-3.5 h-3.5 ${t.icon}`} />
              {label}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl font-bold text-white tabular-nums">{done}</span>
              <span className="text-xs text-slate-500 tabular-nums">/ {total}</span>
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500">
              {key === 'released' ? 'Completed all required courses' : `${total - done} ${pendingLabel}`}
              {key === 'released' && total - done > 0 ? ` • ${total - done} ${pendingLabel}` : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Courses ordered by how many candidates still need them. */
export function PendingCourses({ items, onAsk }) {
  if (!items?.length) return null;
  const max = items[0].count;
  return (
    <section className="bg-[#21222a] border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-violet-400" />
          Pending by course
        </h3>
        <button onClick={() => onAsk('Which course has the most pending candidates, and who are they?')} className="text-[11px] text-indigo-300 hover:text-indigo-200 cursor-pointer">
          Ask AI
        </button>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 6).map(({ course, count }) => (
          <li key={course}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 truncate pr-2">{course}</span>
              <span className="text-slate-400 tabular-nums shrink-0">{count}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-violet-400/80 rounded-full" style={{ width: `${percent(count, max)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
