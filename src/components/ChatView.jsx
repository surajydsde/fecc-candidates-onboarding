import { useRef, useEffect } from 'react';
import { Sparkles, AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { MaterialInputBar } from './MaterialInputBar';
import { APP_NAME, LOGO_SRC, formatDateTime } from '../lib/app';

export function ChatView({ messages, isLoading, error, onSendMessage, chips, onClearError, dataset, onOpenDashboard }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18191e] overflow-hidden relative">
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-1 relative">
        {messages.length === 0 && (
          <div className="max-w-md mx-auto my-4 px-4 text-center">
            <img src={LOGO_SRC} alt="" className="w-16 h-16 mx-auto mb-3.5 rounded-3xl shadow-xl shadow-indigo-600/20" />
            <h2 className="text-base font-bold text-white tracking-tight mb-1">{APP_NAME} Assistant</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Ask about pre-onboarding, post-onboarding, required courses and release candidates. Answers come only from the uploaded Excel sheet.
            </p>

            {dataset ? (
              <button
                onClick={onOpenDashboard}
                className="w-full mb-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-700/40 text-left cursor-pointer hover:bg-emerald-950/50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs text-emerald-200 font-medium truncate">{dataset.fileName}</span>
                  <span className="block text-[10px] text-emerald-300/70">
                    {dataset.rowCount} candidates • uploaded {formatDateTime(dataset.uploadedAt)}
                  </span>
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenDashboard}
                className="w-full mb-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-950/30 border border-amber-700/40 text-left cursor-pointer hover:bg-amber-950/50 transition-colors"
              >
                <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-200">No candidate sheet uploaded yet. Upload one on the Onboarding tab.</span>
              </button>
            )}

            <div className="bg-[#21222a] border border-slate-700/60 rounded-2xl p-3 text-left shadow-md">
              <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider block mb-2 px-1">Try asking</span>
              <div className="grid grid-cols-1 gap-1.5">
                {chips.slice(0, 4).map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => onSendMessage(chip.text)}
                    disabled={isLoading}
                    className="w-full text-left p-2.5 rounded-xl bg-[#1a1b22] hover:bg-indigo-950/40 hover:border-indigo-500/40 border border-slate-700/50 text-xs text-slate-200 transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
                  >
                    <span>{chip.text}</span>
                    <Sparkles className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-2 mb-3.5 px-3" aria-live="polite">
            <img src={LOGO_SRC} alt="" className="w-7 h-7 rounded-lg shrink-0" />
            <div className="bg-[#26272e] border border-[#343640] rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-1.5 shadow-md">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[11px] text-slate-400 ml-2 font-medium">Checking the sheet…</span>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mx-4 my-2 p-3 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={onClearError} className="text-[10px] text-red-300 hover:text-white underline cursor-pointer shrink-0">
              Dismiss
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && <SuggestionChips chips={chips} onSelectChip={onSendMessage} isLoading={isLoading} />}
      <MaterialInputBar onSendMessage={onSendMessage} isLoading={isLoading} />
    </div>
  );
}
