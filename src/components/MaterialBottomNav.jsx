import { MessageSquare, LayoutDashboard } from 'lucide-react';

const TABS = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'dashboard', label: 'Onboarding', icon: LayoutDashboard },
];

export function MaterialBottomNav({ currentTab, onTabChange, messageCount, isAdmin = false }) {
  return (
    <nav aria-label="Main Navigation" className="shrink-0 bg-[#202128] border-t border-[#2d2f39] px-2 py-1.5 flex items-center justify-around z-20 select-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        const badge = tab.id === 'chat' && messageCount > 0 ? messageCount : null;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            id={`bottom-nav-${tab.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-2xl transition-all cursor-pointer relative ${
              isActive ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`flex items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
                isActive ? 'bg-indigo-600/30 shadow-sm border border-indigo-500/20' : 'bg-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
              {tab.id === 'dashboard' && isAdmin && (
                <span className="px-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-bold rounded-sm">Owner</span>
              )}
            </div>
            {badge && (
              <span className="absolute top-1 right-3 px-1.5 bg-indigo-500 text-white text-[9px] font-bold rounded-full shadow-sm">{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
