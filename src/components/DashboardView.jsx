import { useState } from 'react';
import { FileSpreadsheet, Loader2, AlertCircle, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { UploadPanel } from './UploadPanel';
import { SummaryCards, PendingCourses } from './SummaryCards';
import { CandidateList } from './CandidateList';
import { UploadHistory } from './UploadHistory';
import { APP_NAME, LOGO_SRC, formatDateTime } from '../lib/app';

export function DashboardView({ data, loading, loadError, onRetry, isAdmin, onRequestAdmin, onUpload, onDelete, onDownload, onAskAbout }) {
  const [filter, setFilter] = useState('all');
  const active = data?.active;
  const summary = data?.summary;

  return (
    <div className="flex-1 overflow-y-auto bg-[#18191e]">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <header className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="" className="w-12 h-12 rounded-2xl shadow-lg shadow-indigo-600/20" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white tracking-tight">{APP_NAME}</h2>
            <p className="text-xs text-slate-400">Pre-onboarding, post-onboarding, required courses and release status.</p>
          </div>
        </header>

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            Loading candidate data…
          </div>
        )}

        {loadError && (
          <div role="alert" className="p-3 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              {loadError}
            </span>
            <button onClick={onRetry} className="flex items-center gap-1 text-red-200 hover:text-white cursor-pointer shrink-0">
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        <UploadPanel isAdmin={isAdmin} onRequestAdmin={onRequestAdmin} onUpload={onUpload} limits={data?.limits} />

        {data && !active && !loadError && (
          <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-700/60">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-300 font-medium">No candidate sheet yet</p>
            <p className="text-xs text-slate-500 mt-1">
              {isAdmin ? 'Upload the onboarding Excel sheet above to get started.' : 'The owner hasn’t uploaded a candidate sheet yet.'}
            </p>
          </div>
        )}

        {active && summary && (
          <>
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-950/25 border border-emerald-700/40">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-emerald-100 truncate" title={active.fileName}>
                  {active.fileName}
                </div>
                <div className="text-[11px] text-emerald-300/70">
                  Uploaded <time dateTime={active.uploadedAt}>{formatDateTime(active.uploadedAt)}</time> • {active.rowCount} candidates
                </div>
              </div>
              <button
                onClick={() => onAskAbout('Give me an onboarding summary of the latest sheet.')}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-[11px] font-medium text-white cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Ask AI
              </button>
            </div>

            {isAdmin && active.warnings?.length > 0 && (
              <details className="p-3 rounded-2xl bg-amber-950/20 border border-amber-700/40 text-xs text-amber-200">
                <summary className="cursor-pointer flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  {active.warnings.length} note{active.warnings.length > 1 ? 's' : ''} from the last upload
                </summary>
                <ul className="mt-2 space-y-1 list-disc pl-5 text-amber-200/90">
                  {active.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            <SummaryCards summary={summary} activeFilter={filter} onFilter={setFilter} />
            <CandidateList candidates={active.candidates} departments={summary.departments} filter={filter} onFilter={setFilter} onAsk={onAskAbout} />
            <PendingCourses items={summary.pendingByCourse} onAsk={onAskAbout} />
          </>
        )}

        {data && <UploadHistory uploads={data.uploads || []} isAdmin={isAdmin} onDownload={onDownload} onDelete={onDelete} />}

        <p className="text-center text-[10px] text-slate-600 pb-2">Candidate details are personal data. Share this page only with people who need it.</p>
      </div>
    </div>
  );
}
