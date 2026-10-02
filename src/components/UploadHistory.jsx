import { useState } from 'react';
import { History, FileSpreadsheet, Download, Trash2, Loader2, Check, X } from 'lucide-react';
import { formatBytes, formatDateTime, timeAgo } from '../lib/app';

function UploadRow({ upload, isActive, isAdmin, onDownload, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(null); // 'download' | 'delete'
  const [error, setError] = useState(null);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <li className={`p-3 rounded-xl border ${isActive ? 'border-emerald-600/40 bg-emerald-950/15' : 'border-slate-700/50 bg-[#1c1d24]'}`}>
      <div className="flex items-start gap-2.5">
        <FileSpreadsheet className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-slate-200 truncate" title={upload.fileName}>
              {upload.fileName}
            </span>
            {isActive && (
              <span className="shrink-0 px-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-semibold">
                LIVE
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            <time dateTime={upload.uploadedAt}>{formatDateTime(upload.uploadedAt)}</time>
            <span className="text-slate-600"> • {timeAgo(upload.uploadedAt)}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {upload.rowCount} candidates • {formatBytes(upload.size)}
            {upload.summary ? ` • ${upload.summary.released} released` : ''}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-0.5 shrink-0">
            {confirming ? (
              <>
                <button
                  onClick={() => run('delete', () => onDelete(upload))}
                  disabled={busy === 'delete'}
                  className="p-1.5 rounded-full text-red-300 hover:bg-red-900/50 cursor-pointer"
                  title="Confirm delete"
                  aria-label={`Confirm delete ${upload.fileName}`}
                >
                  {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800 cursor-pointer"
                  title="Cancel"
                  aria-label="Cancel delete"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => run('download', () => onDownload(upload))}
                  disabled={busy === 'download'}
                  className="p-1.5 rounded-full text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer"
                  title="Download original file"
                  aria-label={`Download ${upload.fileName}`}
                >
                  {busy === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  title="Delete upload"
                  aria-label={`Delete ${upload.fileName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {confirming && (
        <p className="mt-2 text-[10px] text-red-300/90">
          Delete this upload?{isActive ? ' The previous upload will become live.' : ''}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[10px] text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

export function UploadHistory({ uploads, isAdmin, onDownload, onDelete }) {
  return (
    <section className="bg-[#21222a] border border-slate-700/50 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2.5">
        <History className="w-4 h-4 text-indigo-400" />
        Upload history
        <span className="text-[11px] font-normal text-slate-500">({uploads.length})</span>
      </h3>
      {uploads.length === 0 ? (
        <p className="text-xs text-slate-500">No sheets uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {uploads.map((u, i) => (
            <UploadRow key={u.id} upload={u} isActive={i === 0} isAdmin={isAdmin} onDownload={onDownload} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
