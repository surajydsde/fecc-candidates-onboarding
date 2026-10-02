import { Sparkles, ClipboardCheck, ClipboardList, GraduationCap, Rocket, BarChart3 } from 'lucide-react';

const ICONS = {
  summary: <BarChart3 className="w-3 h-3 text-indigo-400" />,
  pre: <ClipboardList className="w-3 h-3 text-amber-400" />,
  post: <ClipboardCheck className="w-3 h-3 text-sky-400" />,
  courses: <GraduationCap className="w-3 h-3 text-violet-400" />,
  release: <Rocket className="w-3 h-3 text-emerald-400" />,
};

export function SuggestionChips({ chips, onSelectChip, isLoading }) {
  return (
    <div className="shrink-0 py-2 px-3 border-t border-[#262831] bg-[#1a1b21]/80 flex items-center gap-2 overflow-x-auto no-scrollbar select-none z-10">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-indigo-400" />
        Ask:
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          disabled={isLoading}
          onClick={() => onSelectChip(chip.text)}
          id={`suggestion-chip-${chip.id}`}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#262730] hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-200 border border-slate-700/60 hover:border-indigo-500/50 text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          {ICONS[chip.category] || ICONS.summary}
          <span>{chip.text}</span>
        </button>
      ))}
    </div>
  );
}
