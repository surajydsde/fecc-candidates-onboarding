import { useState } from 'react';
import { Lock, Key, X, ShieldAlert, Loader2 } from 'lucide-react';
import { loginRequest } from '../lib/api';

export function AdminAuthModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setError(null);
    setPin('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await loginRequest(pin);
      setPin('');
      onSuccess(token);
    } catch (err) {
      setError(err?.message || 'Could not verify the passcode. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-dialog-title"
      onKeyDown={(e) => e.key === 'Escape' && close()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="bg-[#24252f] border border-indigo-500/30 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-slate-200">
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close dialog"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-2 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h3 id="owner-dialog-title" className="text-base font-bold text-white tracking-tight">
            Owner Verification
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            Unlock to upload candidate sheets. Each upload becomes the live data for the dashboard and the AI assistant.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="owner-passcode" className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Owner Passcode
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="owner-passcode"
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter passcode"
                autoComplete="current-password"
                autoFocus
                className="w-full bg-[#1b1c23] border border-slate-700/80 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800/80 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? 'Checking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
