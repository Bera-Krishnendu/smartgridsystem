import { useState, useEffect } from 'react';

// Default user list if not present in localStorage
const DEFAULT_USERS = [
  {
    username: 'saptak',
    password: 'nabyendu',
    role: 'admin',
    name: 'Saptak (Admin)',
    securityQ: 'pet',
    securityA: 'rocky'
  },
  {
    username: 'operator',
    password: 'operator123',
    role: 'operator',
    name: 'Control Operator',
    securityQ: 'city',
    securityA: 'london'
  },
  {
    username: 'viewer',
    password: 'viewer123',
    role: 'viewer',
    name: 'Guest Viewer',
    securityQ: 'color',
    securityA: 'blue'
  }
];

const SECURITY_QUESTIONS = [
  { id: 'pet', label: 'What was the name of your first pet?' },
  { id: 'city', label: 'In what city were you born?' },
  { id: 'color', label: 'What is your favorite color?' },
  { id: 'school', label: 'What was the name of your elementary school?' }
];

export default function Login({ onLogin }) {
  // Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login');

  // Input states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('operator');
  const [securityQ, setSecurityQ] = useState('pet');
  const [securityA, setSecurityA] = useState('');

  // Password Reset states (Forgot mode)
  const [resetStep, setResetStep] = useState(1); // 1: username, 2: security answer, 3: new password
  const [foundUser, setFoundUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Brute Force protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Initialize DB and mounted animation
  useEffect(() => {
    setTimeout(() => setMounted(true), 60);

    // Initialize users
    if (!localStorage.getItem('mgrid_users')) {
      localStorage.setItem('mgrid_users', JSON.stringify(DEFAULT_USERS));
    }

    // Initialize audit logs
    if (!localStorage.getItem('mgrid_audit_logs')) {
      const initLog = [{
        id: Date.now(),
        type: 'info',
        message: 'Security system initialized with default accounts.',
        timestamp: new Date().toISOString()
      }];
      localStorage.setItem('mgrid_audit_logs', JSON.stringify(initLog));
    }

    // Load lockout state if any
    const savedLock = localStorage.getItem('mgrid_lock_until');
    if (savedLock) {
      const lockTime = parseInt(savedLock, 10);
      if (lockTime > Date.now()) {
        setLockUntil(lockTime);
      }
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockUntil <= Date.now()) {
      setLockUntil(0);
      localStorage.removeItem('mgrid_lock_until');
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockTimeRemaining(remaining);
      if (remaining === 0) {
        setLockUntil(0);
        localStorage.removeItem('mgrid_lock_until');
        setError('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockUntil]);

  // Logging helper
  const addAuditLog = (type, message) => {
    const logs = JSON.parse(localStorage.getItem('mgrid_audit_logs') || '[]');
    const newLog = {
      id: Date.now() + Math.random(),
      type,
      message,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    localStorage.setItem('mgrid_audit_logs', JSON.stringify(logs.slice(0, 100)));
  };

  // Password strength logic
  const getPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: 'Weak', color: '#f87171', rules: { length: false, number: false, capital: false, special: false } };
    let score = 0;
    const rules = {
      length: pw.length >= 6,
      number: /\d/.test(pw),
      capital: /[A-Z]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw)
    };

    if (rules.length) score += 1;
    if (rules.number) score += 1;
    if (rules.capital) score += 1;
    if (rules.special) score += 1;

    let label = 'Weak';
    let color = '#f87171'; // red
    if (score === 2 || score === 3) {
      label = 'Medium';
      color = '#fbbf24'; // yellow
    } else if (score === 4) {
      label = 'Strong';
      color = '#34d399'; // green
    }

    return { score, label, color, rules };
  };

  const strength = getPasswordStrength(mode === 'register' ? password : newPassword);

  // Trigger shake animation
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  // Handle Login
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Check Lockout
    if (lockUntil > Date.now()) {
      setError(`Access locked. Please wait ${lockTimeRemaining}s.`);
      triggerShake();
      return;
    }

    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      triggerShake();
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
      const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

      if (user && user.password === password) {
        setFailedAttempts(0);
        addAuditLog('success', `User ${user.username} (${user.role}) logged in successfully.`);
        setLoading(false);
        // Save current user session
        localStorage.setItem('mgrid_current_user', JSON.stringify(user));
        onLogin(user.username);
      } else {
        setLoading(false);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 3) {
          const lockTime = Date.now() + 30000; // 30 seconds
          setLockUntil(lockTime);
          localStorage.setItem('mgrid_lock_until', lockTime.toString());
          addAuditLog('danger', `Security block triggered: 3 failed attempts for "${username}". Lockout for 30s.`);
          setError('Security Block: Too many failed attempts. Try again in 30 seconds.');
        } else {
          addAuditLog('warning', `Failed login attempt for user "${username}" (Attempt ${newAttempts}/3).`);
          setError(`Invalid credentials. Access denied. (${3 - newAttempts} attempts remaining)`);
        }
        triggerShake();
      }
    }, 900);
  };

  // Handle Register
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password || !name.trim() || !securityA.trim()) {
      setError('Please fill in all fields.');
      triggerShake();
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      triggerShake();
      return;
    }

    if (strength.score < 2) {
      setError('Password is too weak. Provide a medium or strong password.');
      triggerShake();
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
      const userExists = users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());

      if (userExists) {
        setError('Username already registered.');
        setLoading(false);
        triggerShake();
        return;
      }

      const newUser = {
        username: username.trim().toLowerCase(),
        password,
        name: name.trim(),
        role, // operator or viewer
        securityQ,
        securityA: securityA.trim().toLowerCase()
      };

      users.push(newUser);
      localStorage.setItem('mgrid_users', JSON.stringify(users));
      addAuditLog('info', `New user "${newUser.username}" (${newUser.role}) registered successfully.`);

      setLoading(false);
      setSuccess('Account created! You can now log in.');
      setMode('login');
      // Reset form fields
      setPassword('');
      setName('');
      setSecurityA('');
    }, 900);
  };

  // Forgot Password Steps
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (resetStep === 1) {
      if (!username.trim()) {
        setError('Please enter your username.');
        triggerShake();
        return;
      }
      const users = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
      const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

      if (!user) {
        setError('User not found.');
        triggerShake();
      } else {
        setFoundUser(user);
        setResetStep(2);
        setSecurityA('');
      }
    } else if (resetStep === 2) {
      if (!securityA.trim()) {
        setError('Please enter your security answer.');
        triggerShake();
        return;
      }

      if (foundUser.securityA === securityA.trim().toLowerCase()) {
        setResetStep(3);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError('Incorrect security answer.');
        triggerShake();
      }
    } else if (resetStep === 3) {
      if (!newPassword || !confirmPassword) {
        setError('Please fill in all password fields.');
        triggerShake();
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        triggerShake();
        return;
      }

      if (strength.score < 2) {
        setError('Password is too weak.');
        triggerShake();
        return;
      }

      setLoading(true);
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('mgrid_users') || '[]');
        const updatedUsers = users.map(u => {
          if (u.username.toLowerCase() === foundUser.username.toLowerCase()) {
            return { ...u, password: newPassword };
          }
          return u;
        });

        localStorage.setItem('mgrid_users', JSON.stringify(updatedUsers));
        addAuditLog('info', `User "${foundUser.username}" reset their password successfully.`);

        setLoading(false);
        setSuccess('Password updated successfully! Please log in.');
        setMode('login');
        setResetStep(1);
        setFoundUser(null);
        setPassword('');
      }, 900);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleLoginSubmit} noValidate>
      {/* User ID */}
      <div className="login-field">
        <label className="login-label" htmlFor="login-userid">User ID</label>
        <div className="login-input-wrap">
          <span className="login-input-icon">👤</span>
          <input
            id="login-userid"
            className="login-input"
            type="text"
            placeholder="Enter user ID"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            autoComplete="username"
            autoFocus
            disabled={loading || lockUntil > 0}
          />
        </div>
      </div>

      {/* Password */}
      <div className="login-field">
        <label className="login-label" htmlFor="login-password">Password</label>
        <div className="login-input-wrap">
          <span className="login-input-icon">🔒</span>
          <input
            id="login-password"
            className="login-input"
            type={showPass ? 'text' : 'password'}
            placeholder="Enter password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
            disabled={loading || lockUntil > 0}
          />
          <button
            type="button"
            className="login-toggle-pass"
            onClick={() => setShowPass(s => !s)}
            tabIndex={-1}
            aria-label="Toggle password visibility"
          >
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {/* Forgot Password Link */}
      <span
        className="login-forgot-link"
        onClick={() => {
          setMode('forgot');
          setResetStep(1);
          setError('');
          setSuccess('');
        }}
      >
        Forgot Password?
      </span>

      {/* Error / Success messages */}
      {error && (
        <div className="login-error" role="alert">
          <span>⛔</span> {error}
        </div>
      )}
      {success && (
        <div className="login-error" style={{ borderColor: 'rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.08)', color: '#4ade80' }} role="alert">
          <span>✅</span> {success}
        </div>
      )}

      {/* Submit */}
      <button
        id="btn-login-submit"
        className={`login-btn ${loading ? 'login-btn--loading' : ''}`}
        type="submit"
        disabled={loading || !username || !password || lockUntil > 0}
      >
        {loading ? (
          <span className="login-spinner" />
        ) : (
          <>🔓 Access Dashboard</>
        )}
      </button>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegisterSubmit} noValidate>
      {/* Full Name */}
      <div className="login-field">
        <label className="login-label" htmlFor="reg-name">Full Name</label>
        <div className="login-input-wrap">
          <span className="login-input-icon">📛</span>
          <input
            id="reg-name"
            className="login-input"
            type="text"
            placeholder="E.g., John Doe"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            disabled={loading}
          />
        </div>
      </div>

      {/* User ID */}
      <div className="login-field">
        <label className="login-label" htmlFor="reg-userid">Desired User ID</label>
        <div className="login-input-wrap">
          <span className="login-input-icon">👤</span>
          <input
            id="reg-userid"
            className="login-input"
            type="text"
            placeholder="E.g., johndoe"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            disabled={loading}
          />
        </div>
      </div>

      {/* Role */}
      <div className="login-field">
        <label className="login-label" htmlFor="reg-role">Access Role</label>
        <div className="login-input-wrap">
          <select
            id="reg-role"
            className="login-select"
            value={role}
            onChange={e => setRole(e.target.value)}
            disabled={loading}
          >
            <option value="operator">Operator (Read-Write Config)</option>
            <option value="viewer">Viewer (Read-Only)</option>
          </select>
        </div>
      </div>

      {/* Password */}
      <div className="login-field">
        <label className="login-label" htmlFor="reg-password">Password</label>
        <div className="login-input-wrap">
          <span className="login-input-icon">🔒</span>
          <input
            id="reg-password"
            className="login-input"
            type={showPass ? 'text' : 'password'}
            placeholder="Enter secure password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            disabled={loading}
          />
          <button
            type="button"
            className="login-toggle-pass"
            onClick={() => setShowPass(s => !s)}
            tabIndex={-1}
          >
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>

        {/* Strength meter */}
        {password && (
          <div className="pw-strength-container">
            <div className="pw-strength-text">
              <span>Password Strength:</span>
              <span style={{ color: strength.color, fontWeight: 700 }}>{strength.label}</span>
            </div>
            <div className="pw-strength-bar-track">
              <div
                className="pw-strength-bar-fill"
                style={{
                  width: `${(strength.score / 4) * 100}%`,
                  backgroundColor: strength.color
                }}
              />
            </div>
            {/* Rules */}
            <div className="pw-rules">
              <div className={`pw-rule-item ${strength.rules.length ? 'valid' : ''}`}>
                {strength.rules.length ? '✓' : '✗'} 6+ chars
              </div>
              <div className={`pw-rule-item ${strength.rules.number ? 'valid' : ''}`}>
                {strength.rules.number ? '✓' : '✗'} has number
              </div>
              <div className={`pw-rule-item ${strength.rules.capital ? 'valid' : ''}`}>
                {strength.rules.capital ? '✓' : '✗'} has uppercase
              </div>
              <div className={`pw-rule-item ${strength.rules.special ? 'valid' : ''}`}>
                {strength.rules.special ? '✓' : '✗'} has symbol
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Question */}
      <div className="login-field">
        <label className="login-label" htmlFor="reg-sec-q">Security Question (For Recovery)</label>
        <div className="login-input-wrap" style={{ marginBottom: 10 }}>
          <select
            id="reg-sec-q"
            className="login-select"
            value={securityQ}
            onChange={e => setSecurityQ(e.target.value)}
            disabled={loading}
          >
            {SECURITY_QUESTIONS.map(q => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>
        <div className="login-input-wrap">
          <span className="login-input-icon">🔑</span>
          <input
            className="login-input"
            type="text"
            placeholder="Your Answer"
            value={securityA}
            onChange={e => { setSecurityA(e.target.value); setError(''); }}
            disabled={loading}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="login-error" role="alert">
          <span>⛔</span> {error}
        </div>
      )}

      {/* Submit */}
      <button
        id="btn-register-submit"
        className={`login-btn ${loading ? 'login-btn--loading' : ''}`}
        type="submit"
        disabled={loading || !username || !password || !name || !securityA || strength.score < 2}
      >
        {loading ? (
          <span className="login-spinner" />
        ) : (
          <>👤 Register & Account Setup</>
        )}
      </button>
    </form>
  );

  const renderForgotForm = () => (
    <form onSubmit={handleForgotSubmit} noValidate>
      {resetStep === 1 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Enter your username to begin the recovery process.
          </p>
          <div className="login-field">
            <label className="login-label">Username</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">👤</span>
              <input
                className="login-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                disabled={loading}
              />
            </div>
          </div>
        </>
      )}

      {resetStep === 2 && foundUser && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Please answer the security question set up during account creation.
          </p>
          <div className="login-field">
            <label className="login-label">
              {SECURITY_QUESTIONS.find(q => q.id === foundUser.securityQ)?.label || 'Security Question'}
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔑</span>
              <input
                className="login-input"
                type="text"
                placeholder="Enter answer"
                value={securityA}
                onChange={e => { setSecurityA(e.target.value); setError(''); }}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
        </>
      )}

      {resetStep === 3 && foundUser && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Identity verified! Enter a new password for account **{foundUser.username.toUpperCase()}**.
          </p>
          <div className="login-field">
            <label className="login-label">New Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                className="login-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(''); }}
                disabled={loading}
              />
              <button
                type="button"
                className="login-toggle-pass"
                onClick={() => setShowPass(s => !s)}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">Confirm New Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">🔒</span>
              <input
                className="login-input"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                disabled={loading}
              />
            </div>
          </div>

          {newPassword && (
            <div className="pw-strength-container">
              <div className="pw-strength-text">
                <span>Password Strength:</span>
                <span style={{ color: strength.color, fontWeight: 700 }}>{strength.label}</span>
              </div>
              <div className="pw-strength-bar-track">
                <div
                  className="pw-strength-bar-fill"
                  style={{
                    width: `${(strength.score / 4) * 100}%`,
                    backgroundColor: strength.color
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Error message */}
      {error && (
        <div className="login-error" role="alert">
          <span>⛔</span> {error}
        </div>
      )}

      {/* Submit Actions */}
      <button
        className={`login-btn ${loading ? 'login-btn--loading' : ''}`}
        type="submit"
        disabled={loading}
      >
        {loading ? (
          <span className="login-spinner" />
        ) : (
          <>{resetStep === 3 ? '💾 Reset & Save Password' : '➡️ Continue'}</>
        )}
      </button>

      <div style={{ textAlign: 'center' }}>
        <span
          className="login-back-link"
          onClick={() => {
            setMode('login');
            setResetStep(1);
            setFoundUser(null);
            setError('');
            setSuccess('');
          }}
        >
          ← Back to Login
        </span>
      </div>
    </form>
  );

  return (
    <div className="login-root">
      {/* Animated background */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`login-particle login-particle-${i + 1}`} />
        ))}
      </div>

      {/* Card */}
      <div className={`login-card ${mounted ? 'login-card--in' : ''} ${shake ? 'login-card--shake' : ''}`}>

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">⚡</div>
          <div className="login-logo-ring" />
        </div>

        <h1 className="login-title">DC MICROGRID</h1>
        <p className="login-subtitle">Secure Control Panel Access</p>

        <div className="login-divider" />

        {/* Lockout Screen */}
        {lockUntil > 0 ? (
          <div className="lockout-container">
            <span style={{ fontSize: 40 }}>🔒</span>
            <h2 style={{ fontSize: 16, color: '#f87171', fontWeight: 700 }}>Security Lockout Active</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Too many failed login attempts. Verification controls are disabled.
            </p>
            <div className="lockout-timer-display">
              {lockTimeRemaining}s remaining
            </div>
            <p className="login-footer-note" style={{ marginTop: 20 }}>
              System admins can override settings locally.
            </p>
          </div>
        ) : (
          <>
            {/* Mode selection tabs */}
            {mode !== 'forgot' && (
              <div className="login-tabs">
                <button
                  type="button"
                  className={`login-tab-btn ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                >
                  🔐 Sign In
                </button>
                <button
                  type="button"
                  className={`login-tab-btn ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                >
                  👤 Register
                </button>
              </div>
            )}

            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'forgot' && renderForgotForm()}
          </>
        )}

        {lockUntil <= 0 && (
          <p className="login-footer-note">
            ⚡ DC Microgrid ESP32 Monitor &nbsp;·&nbsp; Authorized Personnel Only
          </p>
        )}
      </div>
    </div>
  );
}
