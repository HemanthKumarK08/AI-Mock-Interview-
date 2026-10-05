import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentRoute, onNavigate }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'login')}>
          <div className="brand-logo">🎯</div>
          <div className="brand-text">
            <span className="brand-title">MockInterviewAI</span>
            <span className="brand-badge">Student Edition</span>
          </div>
        </div>

        <nav className="navbar-nav">
          {isAuthenticated ? (
            <>
              <button
                className={`nav-link ${currentRoute === 'dashboard' ? 'active' : ''}`}
                onClick={() => onNavigate('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={`nav-link ${currentRoute === 'setup' || currentRoute === 'review' || currentRoute === 'prepare' || currentRoute === 'session' ? 'active' : ''}`}
                onClick={() => onNavigate('setup')}
              >
                + New Interview
              </button>
              <button
                className={`nav-link ${currentRoute === 'profile' ? 'active' : ''}`}
                onClick={() => onNavigate('profile')}
              >
                Candidate Profile
              </button>
              <div className="nav-user-pill">
                <div className="user-avatar">{user?.name ? user.name[0].toUpperCase() : 'S'}</div>
                <span className="user-name">{user?.name}</span>
                <span className="role-tag">Student</span>
              </div>
              <button className="nav-logout-btn" onClick={logout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-link ${currentRoute === 'login' ? 'active' : ''}`}
                onClick={() => onNavigate('login')}
              >
                Sign In
              </button>
              <button
                className={`nav-btn-primary ${currentRoute === 'register' ? 'active' : ''}`}
                onClick={() => onNavigate('register')}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
