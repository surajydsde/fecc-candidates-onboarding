import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Volume2, VolumeX, User, Database } from 'lucide-react';
import { LOGO_SRC } from '../lib/app';

/** "Checked: …" line: which data checks the answer came from. */
export function AnswerSources({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-slate-700/50" data-testid="answer-sources">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
        <Database className="w-3 h-3" aria-hidden="true" />
        Checked
      </div>
      <ul className="mt-1 space-y-0.5" aria-label="Data the answer was checked against">
        {sources.map((s, i) => (
          <li key={`${s.label}-${i}`} className="text-[11px] leading-snug text-slate-400">
            <span className="text-slate-300">{s.label}</span>
            {s.detail ? <span> · {s.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const isUser = message.role === 'user';
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSpeak = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.text.replace(/[*#`_[\]|]/g, '').trim());
    utterance.rate = 1.05;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`flex flex-col mb-3.5 px-3 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-end gap-2 max-w-[92%] md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs select-none overflow-hidden bg-slate-700 text-slate-300">
          {isUser ? <User className="w-3.5 h-3.5" /> : <img src={LOGO_SRC} alt="Assistant" className="w-full h-full object-cover" />}
        </div>

        <div
          className={`relative min-w-0 px-4 py-3 text-[13.5px] leading-relaxed shadow-md ${
            isUser
              ? 'bg-[#3b3a6e] text-[#f2efff] rounded-2xl rounded-tr-xs border border-indigo-500/30'
              : 'bg-[#26272e] text-[#e3e2e6] rounded-2xl rounded-tl-xs border border-[#343640]'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
          ) : (
            <div className="markdown-body text-slate-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
            </div>
          )}
          {!isUser && <AnswerSources sources={message.sources} />}

          <div
            className={`flex items-center gap-2 mt-2 pt-1 border-t text-[10px] ${
              isUser ? 'border-indigo-400/20 justify-end text-indigo-200/70' : 'border-slate-700/50 justify-between text-slate-400'
            }`}
          >
            <span>{message.timestamp}</span>
            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
              <button onClick={handleCopy} className="hover:text-indigo-300 p-0.5 rounded cursor-pointer" title="Copy text" aria-label="Copy text">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              {!isUser && canSpeak && (
                <button
                  onClick={handleSpeak}
                  className={`p-0.5 rounded cursor-pointer ${speaking ? 'text-indigo-400 animate-pulse' : 'hover:text-indigo-300'}`}
                  title={speaking ? 'Stop speech' : 'Read aloud'}
                  aria-label={speaking ? 'Stop speech' : 'Read aloud'}
                >
                  {speaking ? <VolumeX className="w-3 h-3 text-amber-400" /> : <Volume2 className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
