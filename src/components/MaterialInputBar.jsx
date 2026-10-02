import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, X, Sparkles } from 'lucide-react';

export function MaterialInputBar({ onSendMessage, isLoading, disabled = false }) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setSpeechSupported(true);
    return () => recognition.abort?.();
  }, []);

  const toggleSpeech = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading || disabled) return;
    onSendMessage(trimmed);
    setInputText('');
    resetHeight();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const canSend = inputText.trim() && !isLoading && !disabled;

  return (
    <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#1e1f25] border-t border-[#2d2f38] relative z-10">
      {isListening && (
        <div className="mb-2 flex items-center justify-center gap-2 py-1 px-3 rounded-full bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <span>Listening… speak your question</span>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <div className="flex-1 min-h-[48px] bg-[#292a33] focus-within:bg-[#2d2e38] border border-slate-700/70 focus-within:border-indigo-400/80 rounded-3xl px-4 py-2 flex items-center gap-2 shadow-inner transition-colors">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 opacity-80" />
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            aria-label="Ask a question about the candidates"
            rows={1}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading || disabled}
            maxLength={2000}
            placeholder={isLoading ? 'Checking the sheet…' : 'Ask about candidates…'}
            className="flex-1 bg-transparent text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none resize-none max-h-[120px] py-1"
          />
          {inputText && (
            <button
              onClick={() => {
                setInputText('');
                resetHeight();
              }}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-700/50 cursor-pointer"
              title="Clear input"
              aria-label="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleSpeech}
              id="btn-voice-input"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-700/50'
              }`}
              title={isListening ? 'Stop listening' : 'Ask with your voice'}
              aria-label={isListening ? 'Stop listening' : 'Ask with your voice'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          id="btn-send-message"
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
            canSend
              ? 'bg-gradient-to-tr from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white shadow-indigo-600/30 active:scale-95 cursor-pointer'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none'
          }`}
          title="Send message"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
