import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register({ onNavigate }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('All fields are required');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Registration successful! Redirecting to login...');
      setTimeout(() => {
        onNavigate('login');
      }, 1500);
    } else {
      setErrorMsg(result.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🎓</div>
          <h2>Create Candidate Account</h2>
          <p>Register as a student to begin your mock interview journey</p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-danger">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success">
            <span>✓</span> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password (min. 6 characters)</label>
            <input
              id="reg-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Assigned Role</label>
            <div className="role-display-box">
              <span className="role-icon">👤</span>
              <span className="role-title">Candidate / Student</span>
              <span className="role-note">(Fixed role)</span>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already registered? </span>
          <button className="link-button" onClick={() => onNavigate('login')}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
