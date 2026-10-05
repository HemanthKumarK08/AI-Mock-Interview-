import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      onNavigate('dashboard');
    } else {
      setErrorMsg(result.message || 'Login failed. Please verify credentials.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🔐</div>
          <h2>Student Sign In</h2>
          <p>Access your AI mock interviews and performance analytics</p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-danger">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="candidate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="auth-footer">
          <span>New student candidate? </span>
          <button className="link-button" onClick={() => onNavigate('register')}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
