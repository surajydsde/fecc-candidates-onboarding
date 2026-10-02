import { useState, useEffect, useCallback, useRef } from 'react';
import { AndroidFrame } from './components/AndroidFrame';
import { MaterialTopBar } from './components/MaterialTopBar';
import { MaterialBottomNav } from './components/MaterialBottomNav';
import { ChatView } from './components/ChatView';
import { DashboardView } from './components/DashboardView';
import { AdminAuthModal } from './components/AdminAuthModal';
import { APP_NAME, DEFAULT_SUGGESTION_CHIPS } from './lib/app';
import {
  ApiError,
  chatRequest,
  cleanSources,
  deleteUploadRequest,
  downloadUpload,
  fetchDataset,
  fetchSuggestions,
  ownerToken,
  uploadSheetRequest,
  verifyTokenRequest,
} from './lib/api';

const STORAGE_KEY_MESSAGES = 'fecc_chat_history_v1';

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function initialTab() {
  try {
    if (new URLSearchParams(window.location.search).get('tab') === 'dashboard') return 'dashboard';
  } catch {
    // ignore
  }
  return 'chat';
}

function loadMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_MESSAGES) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [token, setToken] = useState(() => ownerToken.get());
  const isAdmin = Boolean(token);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [data, setData] = useState(null); // { active, summary, uploads, limits }
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const [messages, setMessages] = useState(loadMessages);
  const [chips, setChips] = useState(DEFAULT_SUGGESTION_CHIPS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const lockAdmin = useCallback(() => {
    ownerToken.clear();
    setToken(null);
  }, []);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      setData(await fetchDataset());
    } catch (err) {
      setDataError(err?.message || 'Could not load candidate data.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchSuggestions()
      .then((res) => Array.isArray(res?.suggestions) && res.suggestions.length && setChips(res.suggestions))
      .catch(() => {});
    const saved = ownerToken.get();
    if (saved) verifyTokenRequest(saved).then((valid) => !valid && lockAdmin());
  }, [loadData, lockAdmin]);

  useEffect(() => {
    document.title = currentTab === 'dashboard' ? `Onboarding • ${APP_NAME}` : APP_NAME;
  }, [currentTab]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages.slice(-100)));
    } catch {
      // ignore
    }
  }, [messages]);

  /** Runs an owner-only request; on an expired session, asks to unlock again. */
  const withOwner = async (fn) => {
    if (!token) {
      setShowAdminModal(true);
      throw new Error('Please unlock owner mode first.');
    }
    try {
      return await fn(token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        lockAdmin();
        setShowAdminModal(true);
        throw new Error('Your owner session expired. Unlock again, then retry.', { cause: err });
      }
      throw err;
    }
  };

  const handleUpload = async (file) => {
    const res = await withOwner((t) => uploadSheetRequest(file, t));
    setData((prev) => ({ ...prev, active: res.active, summary: res.summary, uploads: res.uploads }));
    return res;
  };

  const handleDelete = async (upload) => {
    const res = await withOwner((t) => deleteUploadRequest(upload.id, t));
    setData((prev) => ({ ...prev, active: res.active, summary: res.summary, uploads: res.uploads }));
  };

  const handleDownload = (upload) => withOwner((t) => downloadUpload(upload, t));

  const handleSendMessage = async (text) => {
    const question = text.trim();
    if (!question || isLoading) return;
    setError(null);
    const history = messagesRef.current.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text }));
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', text: question, timestamp: nowTime() }]);
    setIsLoading(true);
    try {
      const res = await chatRequest(question, history);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: res.reply || 'No response generated.',
          timestamp: nowTime(),
          sources: cleanSources(res.sources),
        },
      ]);
    } catch (err) {
      setError(err?.message || 'Failed to reach the AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    try {
      const url = new URL(window.location.href);
      if (tab === 'chat') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  const handleAskAbout = (query) => {
    handleTabChange('chat');
    handleSendMessage(query);
  };

  const handleAdminSuccess = (newToken) => {
    ownerToken.set(newToken);
    setToken(newToken);
    setShowAdminModal(false);
    handleTabChange('dashboard');
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <AndroidFrame>
      <MaterialTopBar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onClearChat={handleClearChat}
        messageCount={messages.length}
        isAdmin={isAdmin}
        onRequestAdmin={() => setShowAdminModal(true)}
        onLockAdmin={lockAdmin}
        candidateCount={data?.active?.rowCount || 0}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentTab === 'chat' ? (
          <ChatView
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSendMessage={handleSendMessage}
            chips={chips}
            onClearError={() => setError(null)}
            dataset={data?.active}
            onOpenDashboard={() => handleTabChange('dashboard')}
          />
        ) : (
          <DashboardView
            data={data}
            loading={dataLoading}
            loadError={dataError}
            onRetry={loadData}
            isAdmin={isAdmin}
            onRequestAdmin={() => setShowAdminModal(true)}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onAskAbout={handleAskAbout}
          />
        )}
      </main>

      <MaterialBottomNav currentTab={currentTab} onTabChange={handleTabChange} messageCount={messages.length} isAdmin={isAdmin} />

      <AdminAuthModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
    </AndroidFrame>
  );
}
