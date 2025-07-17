import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [authTokens, setAuthTokens] = useState(() =>
    localStorage.getItem('authTokens')
      ? JSON.parse(localStorage.getItem('authTokens'))
      : null
  );

  const [user, setUser] = useState(() =>
    authTokens ? jwtDecode(authTokens.access) : null
  );

  const [loading, setLoading] = useState(true);

  // Login and store tokens
  const login = (access, refresh) => {
    const tokens = { access, refresh };
    setAuthTokens(tokens);
    setUser(jwtDecode(access));
    localStorage.setItem('authTokens', JSON.stringify(tokens));
    toast.success('✅ Logged in');
  };

  // Logout user
  const logout = () => {
    setAuthTokens(null);
    setUser(null);
    localStorage.removeItem('authTokens');
    navigate('/login');
    toast.info('👋 Logged out');
  };

  // Refresh access token using refresh token
  const refreshToken = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: authTokens?.refresh }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedTokens = { access: data.access, refresh: authTokens.refresh };
        setAuthTokens(updatedTokens);
        setUser(jwtDecode(data.access));
        localStorage.setItem('authTokens', JSON.stringify(updatedTokens));
      } else {
        logout();
      }
    } catch (err) {
      console.error('Token refresh error:', err);
      logout();
    }
  };

  // Setup token refresh interval
  useEffect(() => {
    if (authTokens) {
      const interval = setInterval(() => {
        refreshToken();
      }, 1000 * 60 * 4); // Every 4 mins

      return () => clearInterval(interval);
    }
  }, [authTokens]);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authTokens, login, logout }}>
      {loading ? <div className="text-center mt-5">Loading...</div> : children}
    </AuthContext.Provider>
  );
};
