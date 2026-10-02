import { useState } from 'react';
import { Trash2, Check, RotateCcw, ShieldCheck, Lock, Share2 } from 'lucide-react';
import { APP_NAME, LOGO_SRC } from '../lib/app';

export function MaterialTopBar({
  currentTab,
  onTabChange,
  onClearChat,
  messageCount,
  isAdmin = false,
  onRequestAdmin,
  onLockAdmin,
  candidateCount = 0,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: APP_NAME, text: 'Track candidate onboarding and ask the AI assistant about it.', url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const toggleDashboard = () => onTabChange(currentTab === 'dashboard' ? 'chat' : 'dashboard');

  return (
    <div className="shrink-0 bg-[#202127] border-b border-[#2e3038] px-4 py-2.5 flex items-center justify-between gap-2 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <button
            onClick={toggleDashboard}
            id="btn-avatar-dashboard"
            className="w-10 h-10 rounded-2xl shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer overflow-hidden"
            title="Open onboarding dashboard"
          >
            <img src={LOGO_SRC} alt={`${APP_NAME} logo`} className="w-full h-full object-cover" />
          </button>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#202127] shadow-sm" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-[13.5px] font-semibold text-[#e3e2e6] tracking-tight truncate">{APP_NAME}</h1>
          </div>
          <span className="text-[11px] text-slate-400 font-normal flex items-center gap-1 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {candidateCount > 0 ? `AI assistant • ${candidateCount} candidates` : 'AI assistant'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {isAdmin ? (
          <button
            onClick={onLockAdmin}
            id="btn-topbar-lock"
            className="p-2 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Lock & exit owner mode"
            aria-label="Lock and exit owner mode"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </button>
        ) : (
          <button
            onClick={onRequestAdmin}
            id="btn-topbar-admin-lock"
            className="p-2 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Owner sign in"
            aria-label="Owner sign in"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="relative">
          <button
            onClick={handleShare}
            id="btn-topbar-share"
            className={`p-2 rounded-full transition-all cursor-pointer ${
              copiedLink ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={copiedLink ? 'Link copied!' : 'Share'}
            aria-label="Share"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
          </button>
          {copiedLink && (
            <div className="absolute top-10 right-0 z-30 px-2.5 py-1 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 text-[10px] font-medium rounded-xl whitespace-nowrap shadow-xl pointer-events-none">
              Link copied!
            </div>
          )}
        </div>

        {messageCount > 0 && currentTab === 'chat' && (
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-red-950/80 border border-red-800/60 rounded-full px-2 py-0.5">
                <span className="text-[10px] text-red-200">Clear?</span>
                <button
                  onClick={() => {
                    onClearChat();
                    setShowClearConfirm(false);
                  }}
                  id="btn-confirm-clear"
                  className="p-1 rounded-full text-red-300 hover:text-white hover:bg-red-800/80 cursor-pointer"
                  title="Confirm clear"
                  aria-label="Confirm clear chat"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  id="btn-cancel-clear"
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                id="btn-trigger-clear"
                className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Clear chat history"
                aria-label="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
