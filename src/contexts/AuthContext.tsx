import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
  id: number;
  email: string;
  role: string;
  organization_id?: number;
  name?: string;
  permissions?: {
    canManageUsers?: boolean;
    canManageProjects?: boolean;
    canManageTemplates?: boolean;
    canViewAnalytics?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, twoFactorToken?: string) => Promise<void>;
  register: (email: string, password: string, role?: string, twoFactorToken?: string) => Promise<void>;
  loginWithGitHub: (code: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Decode JWT to get user info (in production, verify with backend)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.id,
          email: payload.email,
          role: payload.role,
          organization_id: payload.organization_id,
          name: payload.name,
          permissions: payload.permissions
        });
      } catch (error) {
        console.error('Invalid token:', error);
        logout();
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email: string, password: string, twoFactorToken?: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
        ...(twoFactorToken ? { twoFactorToken } : {})
      });
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      console.error('Frontend login error:', error, error.response?.data);
      const message = error.response?.data?.error || 'Login failed';
      throw new Error(message);
    }
  };

  const register = async (email: string, password: string, role = 'developer', twoFactorToken?: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        email,
        password,
        role,
        ...(twoFactorToken ? { twoFactorToken } : {})
      });
      
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      throw new Error(message);
    }
  };

  const loginWithGitHub = async (code: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/github`, {
        code
      });
      
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      const message = error.response?.data?.error || 'GitHub authentication failed';
      throw new Error(message);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      loginWithGitHub,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};