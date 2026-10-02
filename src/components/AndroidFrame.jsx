import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Globe, CloudOff, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, BatteryCharging } from 'lucide-react';
import { APP_NAME } from '../lib/app';
import { useDeviceStatus } from '../lib/useDeviceStatus';

function BatteryIcon({ level, charging }) {
  if (charging) return <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />;
  if (level <= 15) return <BatteryWarning className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />;
  if (level <= 40) return <BatteryLow className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />;
  if (level <= 80) return <BatteryMedium className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />;
  return <BatteryFull className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />;
}

/** Status icons from real browser data; anything the browser doesn't expose is left out. */
export function DeviceStatus() {
  const { online, battery } = useDeviceStatus();
  return (
    <div className="flex items-center gap-2 text-slate-300" data-testid="device-status">
      <span
        className={`flex items-center gap-1 text-[10px] font-medium ${online ? 'text-slate-300' : 'text-red-300'}`}
        title={online ? 'Connected to the internet' : 'No internet connection'}
      >
        {online ? <Globe className="w-3.5 h-3.5" aria-hidden="true" /> : <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />}
        {online ? 'Online' : 'Offline'}
      </span>
      {battery && (
        <span
          className="flex items-center gap-0.5"
          title={`Battery ${battery.level}%${battery.charging ? ', charging' : ''}`}
          aria-label={`Battery ${battery.level}%${battery.charging ? ', charging' : ''}`}
        >
          <span className="text-[10px] font-medium tabular-nums">{battery.level}%</span>
          <BatteryIcon level={battery.level} charging={battery.charging} />
        </span>
      )}
    </div>
  );
}

export function AndroidFrame({ children }) {
  const [currentTime, setCurrentTime] = useState('09:41');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#121316] text-[#e3e2e6] flex flex-col items-center justify-center p-0 md:p-4 transition-all duration-300">
      <aside aria-label="Device Controls" className="hidden md:flex items-center justify-between w-full max-w-md mb-2 px-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium text-slate-300">{APP_NAME}</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          id="btn-toggle-expand"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
          title={isExpanded ? 'Switch to Phone Frame' : 'Expand to Full View'}
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Compact Frame</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expand Layout</span>
            </>
          )}
        </button>
      </aside>

      <div
        className={`w-full bg-[#1a1b1f] overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${
          isExpanded
            ? 'max-w-4xl h-[94vh] rounded-2xl border border-slate-700/60 shadow-indigo-950/40'
            : 'max-w-[430px] h-[100dvh] md:h-[900px] md:max-h-[94vh] md:rounded-[44px] md:border-[10px] md:border-[#2b2d33] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]'
        }`}
      >
        <header className="shrink-0 h-10 px-6 pt-1 hidden md:flex items-center justify-between bg-[#1a1b1f] select-none z-30">
          <span className="text-xs font-semibold tracking-tight text-slate-200">{currentTime}</span>
          {!isExpanded && (
            <div className="w-4 h-4 rounded-full bg-[#0c0d0e] border border-slate-700/40 mx-auto shadow-inner flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            </div>
          )}
          <DeviceStatus />
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative">{children}</div>

        <footer className="shrink-0 h-4 bg-[#1a1b1f] hidden md:flex items-center justify-center select-none z-20">
          <div className="w-32 h-1 bg-slate-500/50 rounded-full" />
        </footer>
      </div>
    </div>
  );
}
