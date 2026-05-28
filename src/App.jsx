import { useState, useEffect } from 'react';
import { useGridData } from './hooks/useGridData';
import Gauge from './components/Gauge';
import TrendChart, { COLORS, LABELS } from './components/TrendChart';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function fmt(v, d = 1) { return typeof v === 'number' ? v.toFixed(d) : '—'; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function batteryPercent(v) {
  // 10 V → 0%, 12.8 V → 100%
  return clamp(Math.round(((v - 10) / 2.8) * 100), 0, 100);
}

function solarPower(v, i) { return +(v * Math.abs(i)).toFixed(1); }

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, min, max, color, sub, delay = 0 }) {
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100);
  return (
    <div
      className={`metric-card`}
      style={{ animationDelay: `${delay}ms`, '--card-color': color, '--card-glow': `${color}44` }}
    >
      <div className="metric-icon-wrap">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {fmt(value)}<span className="metric-unit"> {unit}</span>
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
      <div className="metric-bar-track">
        <div className="metric-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RelayCard({ status }) {
  const isOn = status === 'ON';
  return (
    <div className="relay-card" style={{ borderColor: isOn ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)' }}>
      <div className="relay-info">
        <div className={`relay-icon ${isOn ? 'on' : 'off'}`}>
          {isOn ? '🔌' : '⚡'}
        </div>
        <div className="relay-text">
          <h3>System Relay</h3>
          <p>{isOn ? 'Load distribution active — all outputs energized' : 'Load cut-off triggered — battery protection mode'}</p>
        </div>
      </div>
      <div className={`relay-status ${isOn ? 'on' : 'off'}`}>
        {isOn ? '● ACTIVE' : '○ TRIPPED'}
      </div>
    </div>
  );
}

function StatusBadge({ mode }) {
  const map = {
    live:  { cls: 'live',  label: 'LIVE DATA' },
    demo:  { cls: 'demo',  label: 'DEMO MODE' },
    error: { cls: 'error', label: 'ESP32 OFFLINE' },
  };
  const { cls, label } = map[mode] || map.demo;
  return (
    <div className={`status-badge ${cls}`}>
      <div className="status-dot" />
      {label}
    </div>
  );
}

function AlertBanner({ battV, mode }) {
  if (battV < 11.0) {
    return (
      <div className="alert-banner danger">
        🚨 <strong>CRITICAL:</strong> Battery voltage {fmt(battV)} V — load relay tripped to prevent deep discharge!
      </div>
    );
  }
  if (battV < 11.8) {
    return (
      <div className="alert-banner warning">
        ⚠️ <strong>WARNING:</strong> Battery voltage low ({fmt(battV)} V) — charge soon to avoid automatic cutoff.
      </div>
    );
  }
  if (mode === 'demo') {
    return (
      <div className="alert-banner" style={{ background:'rgba(34,211,238,0.06)', border:'1px solid rgba(34,211,238,0.2)', color:'#22d3ee', marginBottom:20 }}>
        ℹ️ <strong>Demo Mode:</strong> No ESP32 IP configured. Enter your device IP above to stream live telemetry.
      </div>
    );
  }
  return null;
}

// ──────────────────────────────────────────────
// Config Panel
// ──────────────────────────────────────────────
function ConfigPanel({ espIp, onApply }) {
  const [draft, setDraft] = useState(espIp || '');
  const [open, setOpen]   = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-outline" onClick={() => setOpen(o => !o)} id="btn-config">
          ⚙️ {open ? 'Hide' : 'Configure'} ESP32 Connection
        </button>
      </div>
      {open && (
        <div className="config-panel">
          <h2>🔧 ESP32 Connection Settings</h2>
          <div className="config-form">
            <div className="form-group">
              <label className="form-label">ESP32 Local IP Address</label>
              <input
                id="input-esp-ip"
                className="form-input"
                type="text"
                placeholder="e.g.  192.168.1.104"
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
            </div>
            <button
              id="btn-connect"
              className="btn btn-primary"
              onClick={() => { onApply(draft.trim()); setOpen(false); }}
            >
              🔗 Connect
            </button>
            <button
              id="btn-demo"
              className="btn btn-outline"
              onClick={() => { onApply(''); setDraft(''); setOpen(false); }}
            >
              📊 Demo Mode
            </button>
          </div>
          <p className="config-note">
            ⚡ The ESP32 must expose <strong>GET /api/data</strong> returning JSON with keys: solarV, windV, battV, solarI, loadI, relayStatus.
            Add CORS header <code>Access-Control-Allow-Origin: *</code> in the ESP32 sketch.
            On Netlify (public URL) only Demo Mode runs — live data works only on the <strong>same local network</strong> as the ESP32.
          </p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main App
// ──────────────────────────────────────────────
export default function App() {
  const [espIp, setEspIp] = useState('');
  const [activeChart, setActiveChart] = useState('voltage');
  const { data, history, mode, lastUpdate } = useGridData(espIp, 2000);

  const { solarV, windV, battV, solarI, loadI, relayStatus } = data;
  const battPct  = batteryPercent(battV);
  const solarPwr = solarPower(solarV, solarI);
  const loadPwr  = +(battV * Math.abs(loadI)).toFixed(1);

  const voltKeys    = ['solarV', 'windV', 'battV'];
  const currentKeys = ['solarI', 'loadI'];

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-radial" />

      <div className="app-layout">
        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="navbar-icon">⚡</div>
            <div>
              <div className="navbar-title">DC MICROGRID CONTROL</div>
              <div className="navbar-subtitle">ESP32 Real-Time Monitoring Dashboard</div>
            </div>
          </div>
          <div className="navbar-right">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              {lastUpdate ? <>Last update<br />{lastUpdate.toLocaleTimeString()}</> : 'Initializing…'}
            </div>
            <StatusBadge mode={mode} />
          </div>
        </nav>

        {/* ── Main ── */}
        <main className="main-content">
          <ConfigPanel espIp={espIp} onApply={setEspIp} />
          <AlertBanner battV={battV} mode={mode} />

          {/* Hero KPI Cards */}
          <div className="hero-stats">
            <MetricCard
              icon="☀️" label="Solar Voltage" value={solarV} unit="V"
              min={0} max={25} color={COLORS.solarV} delay={0}
              sub={`Power: ${solarPwr} W`}
            />
            <MetricCard
              icon="💨" label="Wind Voltage" value={windV} unit="V"
              min={0} max={20} color={COLORS.windV} delay={60}
              sub="AC rectified output"
            />
            <MetricCard
              icon="🔋" label="Battery" value={battV} unit="V"
              min={10} max={14.5} color={COLORS.battV} delay={120}
              sub={`SoC ≈ ${battPct}%`}
            />
            <MetricCard
              icon="⚡" label="Solar Current" value={solarI} unit="A"
              min={0} max={10} color={COLORS.solarI} delay={180}
              sub="ACS712-20A"
            />
            <MetricCard
              icon="🔌" label="Load Current" value={loadI} unit="A"
              min={0} max={10} color={COLORS.loadI} delay={240}
              sub={`Load: ${loadPwr} W`}
            />
          </div>

          {/* Relay Status */}
          <div style={{ marginBottom: 20 }}>
            <RelayCard status={relayStatus} />
          </div>

          {/* Gauges + Trend */}
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Gauges */}
            <div className="chart-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="chart-header">
                <span className="chart-title">📊 Live Gauges</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time arc display</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, justifyItems: 'center' }}>
                <Gauge value={solarV} min={0} max={25} color={COLORS.solarV} label="Solar V" unit="V" />
                <Gauge value={windV}  min={0} max={20} color={COLORS.windV}  label="Wind V"  unit="V" />
                <Gauge value={battV}  min={10} max={14.5} color={COLORS.battV}  label="Batt V"  unit="V" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, justifyItems: 'center' }}>
                <Gauge value={Math.abs(solarI)} min={0} max={10} color={COLORS.solarI} label="Solar A" unit="A" />
                <Gauge value={Math.abs(loadI)}  min={0} max={10} color={COLORS.loadI}  label="Load A"  unit="A" />
              </div>
            </div>

            {/* Trend Chart */}
            <div className="chart-section">
              <div className="chart-header">
                <span className="chart-title">📈 Trend History</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['voltage', 'current'].map(k => (
                    <button
                      key={k}
                      id={`btn-chart-${k}`}
                      className="btn btn-outline"
                      style={{
                        padding: '4px 12px', fontSize: 11,
                        ...(activeChart === k ? {
                          borderColor: 'var(--accent)', color: 'var(--accent)',
                          background: 'var(--accent-dim)'
                        } : {})
                      }}
                      onClick={() => setActiveChart(k)}
                    >
                      {k === 'voltage' ? '⚡ Voltage' : '🔁 Current'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chart-legend" style={{ marginBottom: 12 }}>
                {(activeChart === 'voltage' ? voltKeys : currentKeys).map(k => (
                  <div key={k} className="legend-item">
                    <div className="legend-dot" style={{ background: COLORS[k] }} />
                    {LABELS[k]}
                  </div>
                ))}
              </div>

              <TrendChart
                history={history}
                keys={activeChart === 'voltage' ? voltKeys : currentKeys}
              />
            </div>
          </div>

          {/* Power Flow */}
          <div className="power-flow-section" style={{ marginBottom: 20 }}>
            <div className="power-flow-title">⚡ Power Flow Diagram</div>
            <div className="power-flow-grid">
              {/* Sources */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="power-node" style={{ borderColor: `${COLORS.solarV}44` }}>
                  <span className="power-node-icon">☀️</span>
                  <div className="power-node-label">SOLAR PANEL</div>
                  <div className="power-node-value" style={{ color: COLORS.solarV }}>{fmt(solarPwr)} W</div>
                </div>
                <div className="power-node" style={{ borderColor: `${COLORS.windV}44` }}>
                  <span className="power-node-icon">💨</span>
                  <div className="power-node-label">WIND TURBINE</div>
                  <div className="power-node-value" style={{ color: COLORS.windV }}>{fmt(windV)} V</div>
                </div>
              </div>

              <div className="power-arrow">→</div>

              {/* Battery */}
              <div className="power-node" style={{ borderColor: `${COLORS.battV}44`, padding: 20 }}>
                <span className="power-node-icon">🔋</span>
                <div className="power-node-label">BATTERY BANK</div>
                <div className="power-node-value" style={{ color: COLORS.battV, fontSize: 18 }}>{fmt(battV)} V</div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, background: '#1e2d40', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${battPct}%`, background: COLORS.battV, borderRadius: 4, transition: 'width .6s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>SoC {battPct}%</div>
                </div>
              </div>

              <div className="power-arrow">{relayStatus === 'ON' ? '→' : '✗'}</div>

              {/* Load */}
              <div className="power-node" style={{ borderColor: `${COLORS.loadI}44` }}>
                <span className="power-node-icon">🏭</span>
                <div className="power-node-label">DC LOAD</div>
                <div className="power-node-value" style={{ color: COLORS.loadI }}>{fmt(loadPwr)} W</div>
                <div style={{ marginTop: 6, fontSize: 11, color: relayStatus === 'ON' ? COLORS.battV : '#f87171' }}>
                  {relayStatus === 'ON' ? '● Energized' : '○ Disconnected'}
                </div>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="system-info-grid">
            <div className="info-card">
              <div className="info-card-title">🛠️ System Configuration</div>
              <div className="info-row"><span className="info-row-label">Microcontroller</span><span className="info-row-value">ESP32 DevKit v1</span></div>
              <div className="info-row"><span className="info-row-label">Voltage Sensor</span><span className="info-row-value">5:1 Divider (×3)</span></div>
              <div className="info-row"><span className="info-row-label">Current Sensor</span><span className="info-row-value">ACS712-20A (×2)</span></div>
              <div className="info-row"><span className="info-row-label">LCD Display</span><span className="info-row-value">16×2 I²C (0x27)</span></div>
              <div className="info-row"><span className="info-row-label">Relay Output</span><span className="info-row-value">GPIO 26 (HIGH=ON)</span></div>
              <div className="info-row"><span className="info-row-label">Web Server</span><span className="info-row-value">Port 80 (HTTP)</span></div>
            </div>

            <div className="info-card">
              <div className="info-card-title">⚙️ Protection Thresholds</div>
              <div className="info-row"><span className="info-row-label">Low-Volt Cutoff</span><span className="info-row-value" style={{ color: '#f87171' }}>&lt; 11.0 V</span></div>
              <div className="info-row"><span className="info-row-label">Reconnect Voltage</span><span className="info-row-value" style={{ color: '#4ade80' }}>&gt; 12.0 V</span></div>
              <div className="info-row"><span className="info-row-label">ADC Reference</span><span className="info-row-value">3.3 V / 12-bit</span></div>
              <div className="info-row"><span className="info-row-label">ACS712 Sensitivity</span><span className="info-row-value">66 mV / A</span></div>
              <div className="info-row"><span className="info-row-label">Midpoint Voltage</span><span className="info-row-value">1.65 V</span></div>
              <div className="info-row"><span className="info-row-label">Sample Interval</span><span className="info-row-value">200 ms</span></div>
            </div>

            <div className="info-card">
              <div className="info-card-title">📡 Live Telemetry</div>
              <div className="info-row"><span className="info-row-label">Connection Mode</span>
                <span className="info-row-value" style={{ color: mode === 'live' ? '#4ade80' : mode === 'demo' ? '#fbbf24' : '#f87171' }}>
                  {mode.toUpperCase()}
                </span>
              </div>
              <div className="info-row"><span className="info-row-label">ESP32 IP</span><span className="info-row-value">{espIp || 'Not configured'}</span></div>
              <div className="info-row"><span className="info-row-label">Refresh Rate</span><span className="info-row-value">2 s</span></div>
              <div className="info-row"><span className="info-row-label">History Buffer</span><span className="info-row-value">{history.length} / 30 pts</span></div>
              <div className="info-row"><span className="info-row-label">Solar Power</span><span className="info-row-value" style={{ color: COLORS.solarV }}>{solarPwr} W</span></div>
              <div className="info-row"><span className="info-row-label">Load Power</span><span className="info-row-value" style={{ color: COLORS.loadI }}>{loadPwr} W</span></div>
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="footer">
          <div>
            <span className="footer-brand">⚡ DC Microgrid</span>
            {' '}— ESP32 IoT Dashboard
          </div>
          <div>Built with React + Recharts · Deploy on <strong style={{ color: 'var(--accent)' }}>Netlify</strong></div>
          <div>© 2026 Smart Grid System</div>
        </footer>
      </div>
    </>
  );
}
