import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import InterviewSetup from './pages/InterviewSetup';
import InterviewReview from './pages/InterviewReview';
import InterviewPrepare from './pages/InterviewPrepare';
import InterviewSession from './pages/InterviewSession';
import InterviewStudio from './pages/InterviewStudio';
import InterviewReport from './pages/InterviewReport';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function MainContent() {
  const { isAuthenticated, loading } = useAuth();
  const [route, setRoute] = useState('dashboard');
  const [interviewConfig, setInterviewConfig] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [reportSessionId, setReportSessionId] = useState(null);

  // Default routes based on authentication status
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && (route === 'login' || route === 'register')) {
        setRoute('dashboard');
      } else if (!isAuthenticated && route !== 'login' && route !== 'register') {
        setRoute('login');
      }
    }
  }, [isAuthenticated, loading]);

  const handleNavigate = (newRoute, params) => {
    if (newRoute === 'report' && params) {
      if (typeof params === 'object' && params.id) {
        setReportSessionId(params.id);
        setActiveSession(params);
      } else {
        setReportSessionId(params);
      }
    }
    setRoute(newRoute);
  };

  const handleConfigSaved = (config) => {
    setInterviewConfig(config);
  };

  const handleSessionCreated = (session) => {
    setActiveSession(session);
  };

  const handleSessionUpdated = (session) => {
    setActiveSession(session);
  };

  const handleResumeSession = (session) => {
    setActiveSession(session);
  };

  return (
    <div className="app-layout">
      <Navbar currentRoute={route} onNavigate={handleNavigate} />
      <main className="main-content">
        {route === 'login' && <Login onNavigate={handleNavigate} />}
        {route === 'register' && <Register onNavigate={handleNavigate} />}
        
        {route === 'dashboard' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <Dashboard onNavigate={handleNavigate} onResumeSession={handleResumeSession} />
          </ProtectedRoute>
        )}

        {route === 'setup' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <InterviewSetup onNavigate={handleNavigate} onConfigSaved={handleConfigSaved} />
          </ProtectedRoute>
        )}

        {route === 'review' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <InterviewReview
              config={interviewConfig}
              onNavigate={handleNavigate}
              onSessionCreated={handleSessionCreated}
            />
          </ProtectedRoute>
        )}

        {route === 'prepare' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <InterviewPrepare
              session={activeSession}
              onNavigate={handleNavigate}
              onSessionUpdated={handleSessionUpdated}
            />
          </ProtectedRoute>
        )}

        {route === 'session' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <InterviewStudio
              session={activeSession}
              onNavigate={handleNavigate}
            />
          </ProtectedRoute>
        )}

        {route === 'report' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <InterviewReport
              sessionId={reportSessionId || activeSession?.id}
              onNavigate={handleNavigate}
            />
          </ProtectedRoute>
        )}

        {route === 'profile' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <Profile onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
