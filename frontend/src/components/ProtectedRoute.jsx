import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, onNavigate }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Verifying authentication context...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // If not authenticated, prompt navigation to login
    return (
      <div className="auth-redirect-container">
        <div className="auth-redirect-box">
          <div className="redirect-icon">🔒</div>
          <h3>Authentication Required</h3>
          <p>You must be signed in as a student candidate to access this page.</p>
          <button className="btn-primary" onClick={() => onNavigate('login')}>
            Proceed to Sign In
          </button>
        </div>
      </div>
    );
  }

  return children;
}
