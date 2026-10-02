import { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, Lock, Download, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { SAMPLE_SHEET_URL, formatBytes } from '../lib/app';

const DEFAULT_LIMITS = { maxBytes: 3 * 1024 * 1024, extensions: ['.xlsx', '.csv'] };

export function validateFile(file, limits = DEFAULT_LIMITS) {
  if (!file) return 'Choose a file to upload.';
  const ext = (file.name.toLowerCase().match(/\.[a-z0-9]+$/) || [''])[0];
  if (ext === '.xls') return 'Old .xls files are not supported. Open it in Excel and save as .xlsx.';
  if (!limits.extensions.includes(ext)) return 'Please choose an Excel (.xlsx) or CSV file.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > limits.maxBytes) return `The file is larger than ${formatBytes(limits.maxBytes)}.`;
  return null;
}

export function UploadPanel({ isAdmin, onRequestAdmin, onUpload, limits }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message, warnings }

  const handleFile = async (file) => {
    const problem = validateFile(file, limits || DEFAULT_LIMITS);
    if (problem) {
      setResult({ type: 'error', message: problem });
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const data = await onUpload(file);
      setResult({
        type: 'success',
        message: `${data.upload.fileName} uploaded — ${data.upload.rowCount} candidates are now live.`,
        warnings: data.upload.warnings || [],
      });
    } catch (err) {
      setResult({ type: 'error', message: err?.message || 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const sampleLink = (
    <a
      href={SAMPLE_SHEET_URL}
      download
      className="inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
    >
      <Download className="w-3 h-3" />
      Sample Excel
    </a>
  );

  if (!isAdmin) {
    return (
      <section className="bg-[#21222a] border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Upload candidate sheet</h3>
            <p className="text-xs text-slate-400 mt-0.5">Only the owner can upload. Sign in to add a new sheet.</p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={onRequestAdmin}
                id="btn-owner-signin-upload"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer"
              >
                Owner sign in
              </button>
              {sampleLink}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#21222a] border border-indigo-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-white">Upload candidate sheet</h3>
        {sampleLink}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose an Excel or CSV file to upload"
        aria-disabled={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-1.5 py-6 px-4 rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer ${
          dragging ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-600/70 hover:border-indigo-400/70 hover:bg-[#1c1d24]'
        } ${uploading ? 'opacity-70 cursor-wait' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            <span className="text-xs text-slate-200 font-medium">Reading and saving the sheet…</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-7 h-7 text-indigo-400" />
            <span className="text-xs text-slate-200 font-medium">Tap to choose a file, or drop it here</span>
            <span className="text-[10px] text-slate-500">
              Excel (.xlsx) or CSV, up to {formatBytes((limits || DEFAULT_LIMITS).maxBytes)}
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {result && (
        <div
          role={result.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 p-2.5 rounded-xl text-xs border ${
            result.type === 'error' ? 'bg-red-950/50 border-red-800/60 text-red-200' : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{result.message}</span>
          </div>
          {result.warnings?.length > 0 && (
            <ul className="mt-2 space-y-1 text-amber-200/90">
              {result.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2.5 flex items-start gap-1.5 text-[10px] text-slate-500">
        <FileSpreadsheet className="w-3 h-3 shrink-0 mt-px" />
        The newest upload becomes the live data for the dashboard and the AI assistant. Earlier uploads stay in the history below.
      </p>
    </section>
  );
}
