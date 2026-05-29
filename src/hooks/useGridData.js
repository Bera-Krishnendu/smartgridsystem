import { useState, useEffect, useRef, useCallback } from 'react';

const HISTORY_LIMIT = 30;

// Zero/idle data — shown by default when no ESP32 connected and demo is off
const IDLE_DATA = {
  solarV: 0, windV: 0, battV: 0, solarI: 0, loadI: 0,
  relayStatus: 'OFF', ts: Date.now()
};

// Realistic simulation curves for demo mode
function simValue(base, amplitude, phase, t) {
  return +(base + amplitude * Math.sin((t / 8000) * 2 * Math.PI + phase) + (Math.random() - 0.5) * amplitude * 0.15).toFixed(2);
}

function generateDemo(t) {
  const solarV = simValue(18.5, 2.5, 0, t);
  const windV  = simValue(14.2, 3.0, 1.2, t);
  const battV  = simValue(12.4, 0.6, 2.1, t);
  const solarI = simValue(3.2,  0.8, 0.5, t);
  const loadI  = simValue(2.1,  0.5, 1.8, t);
  const relayStatus = battV < 11.0 ? 'OFF (LOW BATTERY)' : 'ON';

  return { solarV, windV, battV, solarI, loadI, relayStatus, ts: Date.now() };
}

// espIp: string (ESP32 IP address or empty)
// demoActive: boolean (true = show demo data, false = show zeros when no ESP32)
export function useGridData(espIp, demoActive = false, interval = 3000) {
  const [data, setData]       = useState(IDLE_DATA);
  const [history, setHistory] = useState([]);
  const [mode, setMode]       = useState('idle');   // 'live' | 'demo' | 'error' | 'idle'
  const [lastUpdate, setLastUpdate] = useState(null);
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());

  const fetchLive = useCallback(async () => {
    let cleanIp = espIp.trim();
    // Strip http:// or https:// if user entered it
    cleanIp = cleanIp.replace(/^(https?:\/\/)/i, '');
    const url = `http://${cleanIp}/api/data`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('bad response');
      const json = await res.json();
      const point = { ...json, ts: Date.now() };
      setData(point);
      setHistory(h => [...h.slice(-HISTORY_LIMIT + 1), point]);
      setMode('live');
      setLastUpdate(new Date());
      return true;
    } catch {
      return false;
    }
  }, [espIp]);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current;

    if (espIp) {
      // ESP32 IP is set — try to fetch live data
      fetchLive().then(ok => {
        if (!ok) {
          // Failed to reach ESP32
          setMode('error');
          setLastUpdate(new Date());
        }
      });
    } else if (demoActive) {
      // No ESP32, but demo mode is ON — show simulated data
      const point = generateDemo(elapsed);
      setData(point);
      setHistory(h => [...h.slice(-HISTORY_LIMIT + 1), point]);
      setMode('demo');
      setLastUpdate(new Date());
    } else {
      // No ESP32, demo OFF — show all zeros
      setData({ ...IDLE_DATA, ts: Date.now() });
      setHistory([]);
      setMode('idle');
      setLastUpdate(null);
    }
  }, [espIp, demoActive, fetchLive]);

  useEffect(() => {
    tick();
    timerRef.current = setInterval(tick, interval);
    return () => clearInterval(timerRef.current);
  }, [tick, interval]);

  return { data, history, mode, lastUpdate };
}
