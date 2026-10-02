import { useEffect, useState } from 'react';

/**
 * Real device status, only where the browser exposes it.
 * - online: navigator.onLine plus online/offline events (all browsers).
 * - battery: Battery Status API (Chrome, Edge, other Chromium browsers). null when unsupported or blocked.
 * Browsers don't reveal whether the connection is Wi-Fi or mobile data, so we never claim either.
 */
export function useDeviceStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [battery, setBattery] = useState(null); // { level: 0-100, charging: boolean } | null

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return;
    let manager = null;
    let cancelled = false;
    const read = () => {
      if (!cancelled && manager) setBattery({ level: Math.round(manager.level * 100), charging: Boolean(manager.charging) });
    };
    navigator
      .getBattery()
      .then((m) => {
        if (cancelled) return;
        manager = m;
        read();
        m.addEventListener('levelchange', read);
        m.addEventListener('chargingchange', read);
      })
      .catch(() => setBattery(null)); // blocked by the page's permissions policy, or unsupported
    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener('levelchange', read);
        manager.removeEventListener('chargingchange', read);
      }
    };
  }, []);

  return { online, battery };
}
