import { useState, useEffect, useRef, useCallback } from 'react';
import { useGridData } from './hooks/useGridData';
import Gauge from './components/Gauge';
import Login from './components/Login';
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
// Config Panel (With Role Restriction)
// ──────────────────────────────────────────────
function ConfigPanel({ espIp, onApply, role }) {
  const [draft, setDraft] = useState(espIp || '');
  const [open, setOpen]   = useState(false);
  const isViewer = role === 'viewer';

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
                placeholder={isViewer ? "Connection settings locked" : "e.g.  192.168.1.104"}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={isViewer}
              />
            </div>
            <button
              id="btn-connect"
              className="btn btn-primary"
              onClick={() => { onApply(draft.trim()); setOpen(false); }}
              disabled={isViewer || !draft}
            >
              🔗 Connect
            </button>
            <button
              id="btn-demo"
              className="btn btn-outline"
              onClick={() => { onApply(''); setDraft(''); setOpen(false); }}
              disabled={isViewer}
            >
              📊 Demo Mode
            </button>
          </div>
          {isViewer ? (
            <p className="config-note" style={{ borderLeftColor: '#f87171', background: 'rgba(248,113,113,0.04)' }}>
              🔒 <strong>Read-Only Access:</strong> You are logged in as a Guest Viewer. Modifying the connection settings or configuring the ESP32 IP is restricted to Operators and Administrators.
            </p>
          ) : (
            <p className="config-note">
              ⚡ The ESP32 must expose <strong>GET /api/data</strong> returning JSON with keys: solarV, windV, battV, solarI, loadI, relayStatus.
              Add CORS header <code>Access-Control-Allow-Origin: *</code> in the ESP32 sketch.
              On Netlify (public URL) only Demo Mode runs — live data works only on the <strong>same local network</strong> as the ESP32.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Security & Access Control Panel Component
// ──────────────────────────────────────────────
function SecurityCenter({ currentUser, addAuditLog }) {
  const [activeTab, setActiveTab] = useState('logs');
  const [users, setUsers] = useState(() => JSON.parse(localStorage.getItem('mgrid_users') || '[]'));
  const [logs, setLogs] = useState(() => JSON.parse(localStorage.getItem('mgrid_audit_logs') || '[]'));

  // User creation states
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('operator');
  const [newSecurityQ, setNewSecurityQ] = useState('pet');
  const [newSecurityA, setNewSecurityA] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reload logs & users periodically or when modified
  const refreshData = () => {
    setUsers(JSON.parse(localStorage.getItem('mgrid_users') || '[]'));
    setLogs(JSON.parse(localStorage.getItem('mgrid_audit_logs') || '[]'));
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateUser = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUsername.trim() || !newPassword || !newName.trim() || !newSecurityA.trim()) {
      setError('All fields are required.');
      return;
    }

    if (newUsername.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    const usernameLower = newUsername.trim().toLowerCase();
    const existingUsers = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
    if (existingUsers.some(u => u.username.toLowerCase() === usernameLower)) {
      setError('Username already exists.');
      return;
    }

    const newUser = {
      username: usernameLower,
      password: newPassword,
      name: newName.trim(),
      role: newRole,
      securityQ: newSecurityQ,
      securityA: newSecurityA.trim().toLowerCase()
    };

    const updated = [...existingUsers, newUser];
    localStorage.setItem('mgrid_users', JSON.stringify(updated));
    setUsers(updated);

    addAuditLog('info', `New access credentials created for user "${newUser.username}" (${newUser.role}) by admin.`);
    
    setSuccess(`Account "${newUser.username}" successfully created!`);
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    setNewSecurityA('');
  };

  const handleDeleteUser = (usernameToDelete) => {
    if (usernameToDelete.toLowerCase() === 'saptak' || usernameToDelete.toLowerCase() === currentUser.username.toLowerCase()) {
      alert('Security Protection: Cannot delete the primary administrator or your own active session.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently revoke credentials for "${usernameToDelete}"?`)) {
      return;
    }

    const existingUsers = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
    const updated = existingUsers.filter(u => u.username.toLowerCase() !== usernameToDelete.toLowerCase());
    localStorage.setItem('mgrid_users', JSON.stringify(updated));
    setUsers(updated);

    addAuditLog('warning', `Admin "${currentUser.username}" revoked credentials for user "${usernameToDelete}".`);
  };

  const handleClearLogs = () => {
    if (!window.confirm('Wipe security history? This cannot be undone.')) return;
    const initLog = [{
      id: Date.now(),
      type: 'info',
      message: `Audit log history cleared by Admin "${currentUser.username}".`,
      timestamp: new Date().toISOString()
    }];
    localStorage.setItem('mgrid_audit_logs', JSON.stringify(initLog));
    setLogs(initLog);
    addAuditLog('info', 'Audit logs cleared.');
  };

  const formatLogTime = (timeStr) => {
    try {
      const d = new Date(timeStr);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch (e) {
      return timeStr;
    }
  };

  const getLogClass = (type) => {
    if (type === 'success') return 'success';
    if (type === 'warning') return 'warning';
    if (type === 'danger') return 'danger';
    return 'info';
  };

  const getLogEmoji = (type) => {
    if (type === 'success') return '🟢';
    if (type === 'warning') return '⚠️';
    if (type === 'danger') return '🚨';
    return 'ℹ️';
  };

  const questionLabels = {
    pet: 'First Pet',
    city: 'Birth City',
    color: 'Fav Color',
    school: 'Elementary School'
  };

  return (
    <div className="security-panel">
      <div className="security-header">
        <h2 className="security-title">🛡️ Security & Access Control Center</h2>
        <div className="security-tabs">
          <button
            className={`security-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📋 Audit Logs ({logs.length})
          </button>
          <button
            className={`security-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 User Registry ({users.length})
          </button>
        </div>
      </div>

      {activeTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing recent authentication and operational activities.
            </span>
            <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={handleClearLogs}>
              🧹 Clear History
            </button>
          </div>
          <div className="audit-log-list">
            {logs.map(log => (
              <div key={log.id} className={`audit-log-item ${getLogClass(log.type)}`}>
                <span className="audit-log-icon">{getLogEmoji(log.type)}</span>
                <div className="audit-log-meta">
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{log.message}</span>
                  <span className="audit-log-time">{formatLogTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className="user-table-wrap" style={{ marginBottom: 16 }}>
            <table className="user-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>System Access Level</th>
                  <th>Security Verification</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{u.username}</td>
                    <td>{u.name}</td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        {u.role === 'admin' ? '👑 ' : u.role === 'operator' ? '⚙️ ' : '👁️ '}
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      Q: {questionLabels[u.securityQ] || u.securityQ} / A: ***
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{
                          padding: '4px 8px', fontSize: 11, borderColor: '#f8717133', color: '#f87171',
                          background: 'rgba(248,113,113,0.02)'
                        }}
                        onClick={() => handleDeleteUser(u.username)}
                        disabled={u.username.toLowerCase() === 'saptak' || u.username.toLowerCase() === currentUser.username.toLowerCase()}
                      >
                        🗑️ Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>➕ Add System Operator or Viewer</h3>
          <form onSubmit={handleCreateUser} className="user-create-form" noValidate>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="E.g., John Doe"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">User ID</label>
              <input
                className="form-input"
                type="text"
                placeholder="E.g., johndoe"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Temp Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Type password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Role</label>
              <select
                className="login-select"
                style={{ padding: '8px 12px', height: 40 }}
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
              >
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Security Question</label>
              <select
                className="login-select"
                style={{ padding: '8px 12px', height: 40 }}
                value={newSecurityQ}
                onChange={e => setNewSecurityQ(e.target.value)}
              >
                <option value="pet">What was the name of your first pet?</option>
                <option value="city">In what city were you born?</option>
                <option value="color">What is your favorite color?</option>
                <option value="school">What was the name of your elementary school?</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Answer Verification</label>
              <input
                className="form-input"
                type="text"
                placeholder="Answer text"
                value={newSecurityA}
                onChange={e => setNewSecurityA(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ height: 40, padding: '0 16px', gridColumn: 'span 4', width: 'fit-content', marginLeft: 'auto' }}>
              💾 Create Account
            </button>
          </form>
          {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>⛔ {error}</div>}
          {success && <div style={{ color: '#4ade80', fontSize: 12, marginTop: 8 }}>✅ {success}</div>}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main App
// ──────────────────────────────────────────────
export default function App() {
  // ── Auth state loaded from session ──
  const [currentUser, setCurrentUser] = useState(() => {
    const session = localStorage.getItem('mgrid_current_user');
    return session ? JSON.parse(session) : null;
  });

  const [espIp, setEspIp] = useState('');
  const [activeChart, setActiveChart] = useState('voltage');
  const { data, history, mode, lastUpdate } = useGridData(espIp, 3000);

  // Inactivity timeout tracking
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);

  // Audit logging helper
  const addAuditLog = useCallback((type, message) => {
    const logs = JSON.parse(localStorage.getItem('mgrid_audit_logs') || '[]');
    const newLog = {
      id: Date.now() + Math.random(),
      type,
      message,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    localStorage.setItem('mgrid_audit_logs', JSON.stringify(logs.slice(0, 100)));
  }, []);

  const handleLogin = (username) => {
    const session = localStorage.getItem('mgrid_current_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    setLastActivity(Date.now());
    setShowTimeoutWarning(false);
    setTimeoutCountdown(30);
  };

  const handleLogout = useCallback(() => {
    if (currentUser) {
      addAuditLog('info', `User "${currentUser.username}" logged out.`);
    }
    localStorage.removeItem('mgrid_current_user');
    setCurrentUser(null);
  }, [currentUser, addAuditLog]);

  // Session Timeout Inactivity Effect
  useEffect(() => {
    if (!currentUser) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
      setShowTimeoutWarning(false);
      setTimeoutCountdown(30);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivity) / 1000);
      
      // 5 minutes total: Warning opens at 4.5 minutes (270s)
      if (elapsed >= 270) {
        setShowTimeoutWarning(true);
        const remaining = Math.max(0, 300 - elapsed);
        setTimeoutCountdown(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          addAuditLog('danger', `Session expired due to inactivity for user "${currentUser.username}".`);
          handleLogout();
        }
      } else {
        setShowTimeoutWarning(false);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(interval);
    };
  }, [currentUser, lastActivity, addAuditLog, handleLogout]);

  // Handle ESP32 connection change
  const handleApplyIp = (ip) => {
    setEspIp(ip);
    if (ip) {
      addAuditLog('info', `ESP32 connection IP changed to "${ip}" by user "${currentUser?.username}".`);
    } else {
      addAuditLog('info', `Connection switched to Demo Mode by user "${currentUser?.username}".`);
    }
  };

  // Render login wall if not authenticated
  if (!currentUser) return <Login onLogin={handleLogin} />;

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

      {/* Inactivity Warning Modal */}
      {showTimeoutWarning && (
        <div className="timeout-overlay">
          <div className="timeout-modal">
            <div className="timeout-icon">⏰</div>
            <h2 className="timeout-title">Inactivity Warning</h2>
            <p className="timeout-desc">
              You have been inactive for a while. To protect control operations, your session will automatically lock soon.
            </p>
            <span className="timeout-timer">
              00:{timeoutCountdown < 10 ? `0${timeoutCountdown}` : timeoutCountdown}
            </span>
            <div className="timeout-actions">
              <button className="btn btn-primary" onClick={() => setLastActivity(Date.now())}>
                Extend Session
              </button>
              <button className="btn btn-outline" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* User badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(34,211,238,0.08)',
              border: '1px solid rgba(34,211,238,0.2)',
              fontSize: 12, fontWeight: 600, color: 'var(--accent)',
            }}>
              <span>👤</span> {currentUser.name.toUpperCase()} 
              <span className={`role-badge ${currentUser.role}`} style={{ marginLeft: 4, transform: 'scale(0.95)', padding: '2px 6px' }}>
                {currentUser.role.toUpperCase()}
              </span>
            </div>
            <button
              id="btn-logout"
              className="btn btn-outline"
              onClick={handleLogout}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              🔓 Logout
            </button>
          </div>
        </nav>

        {/* ── Main ── */}
        <main className="main-content">
          <ConfigPanel espIp={espIp} onApply={handleApplyIp} role={currentUser.role} />
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

          {/* Security & Access Center (For Administrators Only) */}
          {currentUser.role === 'admin' && (
            <SecurityCenter currentUser={currentUser} addAuditLog={addAuditLog} />
          )}

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
          <div>Built with React + Recharts · Deploy on <strong style={{ color: 'var(--accent)' }}>Netlify</strong>By Krishnendu Bera</div>
          <div>© 2026 Smart Grid System</div>
        </footer>
      </div>
    </>
  );
}
