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

interface OnboardingProfile {
  account_type: string;
  organization_name?: string;
  company_domain?: string;
  team_size?: string;
  role?: string;
  use_cases?: string[];
  clouds?: string[];
  security_requirements?: string[];
  security_contact_email?: string;
  ai_integration?: boolean;
  ai_provider?: string;
  ai_integration_method?: string;
  ai_integration_notes?: string;
  consent_terms?: boolean;
  consent_privacy?: boolean;
}

interface OnboardingStatus {
  completed: boolean;
  demo_mode?: boolean;
  profile?: OnboardingProfile;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, twoFactorToken?: string) => Promise<void>;
  register: (email: string, password: string, role?: string, twoFactorToken?: string) => Promise<void>;
  loginWithGitHub: (code: string, redirectUri?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  onboarding: OnboardingStatus | null;
  refreshOnboarding: (overrideToken?: string | null) => Promise<void>;
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
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);

  const refreshOnboarding = async (overrideToken?: string | null) => {
    if (!token && !overrideToken) {
      setOnboarding(null);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/onboarding/status`);
      setOnboarding(response.data);
    } catch (error) {
      setOnboarding({ completed: false, demo_mode: true });
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';
        if (status && [401, 403].includes(status) && !url.includes('/api/auth')) {
          logout();
          window.location.href = '/login?expired=1';
        }
        return Promise.reject(error);
      }
    );

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
    if (token) {
      refreshOnboarding();
    }
    setLoading(false);
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
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
      await refreshOnboarding(newToken);
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
      await refreshOnboarding(newToken);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      throw new Error(message);
    }
  };

  const loginWithGitHub = async (code: string, redirectUri?: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/github`, {
        code,
        redirectUri
      });
      
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      await refreshOnboarding(newToken);
    } catch (error: any) {
      const message = error.response?.data?.error || 'GitHub authentication failed';
      throw new Error(message);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOnboarding(null);
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
      loading,
      onboarding,
      refreshOnboarding
    }}>
      {children}
    </AuthContext.Provider>
  );
};
