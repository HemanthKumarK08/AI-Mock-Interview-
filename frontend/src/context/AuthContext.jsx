import { createContext, useContext, useState, useEffect } from 'react';
import ApiService from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const token = ApiService.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await ApiService.getMe();
        if (res.success && res.data?.user) {
          setUser(res.data.user);
        } else {
          setUser(null);
          ApiService.clearToken();
        }
      } catch (err) {
        setUser(null);
        ApiService.clearToken();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await ApiService.login(email, password);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const res = await ApiService.register(name, email, password);
      return { success: true, message: res.message };
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } catch (e) {
      // Non-fatal
    } finally {
      setUser(null);
      ApiService.clearToken();
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    register,
    logout,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
