import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { DeviceStatus } from '../components/AndroidFrame';

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

afterEach(() => {
  delete window.navigator.getBattery;
  setOnline(true);
  vi.restoreAllMocks();
});

describe('DeviceStatus', () => {
  it('shows online/offline from the browser and follows changes', () => {
    setOnline(true);
    render(<DeviceStatus />);
    expect(screen.getByText('Online')).toBeInTheDocument();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('hides the battery when the browser does not expose it', () => {
    render(<DeviceStatus />);
    expect(screen.queryByLabelText(/Battery/)).not.toBeInTheDocument();
    expect(screen.getByTestId('device-status').textContent).not.toMatch(/%/);
  });

  it('shows the real battery level and charging state, and updates on change', async () => {
    const listeners = {};
    const manager = {
      level: 0.62,
      charging: false,
      addEventListener: (type, fn) => (listeners[type] = fn),
      removeEventListener: vi.fn(),
    };
    window.navigator.getBattery = () => Promise.resolve(manager);
    render(<DeviceStatus />);
    expect(await screen.findByLabelText('Battery 62%')).toBeInTheDocument();
    act(() => {
      manager.level = 0.63;
      manager.charging = true;
      listeners.chargingchange();
    });
    expect(screen.getByLabelText('Battery 63%, charging')).toBeInTheDocument();
  });

  it('hides the battery when the browser blocks it', async () => {
    window.navigator.getBattery = () => Promise.reject(new Error('blocked'));
    render(<DeviceStatus />);
    await waitFor(() => expect(screen.queryByLabelText(/Battery/)).not.toBeInTheDocument());
  });

  it('never shows made-up network types', () => {
    render(<DeviceStatus />);
    expect(screen.getByTestId('device-status').textContent).not.toMatch(/5G|4G|LTE|Wi-?Fi/i);
  });
});
