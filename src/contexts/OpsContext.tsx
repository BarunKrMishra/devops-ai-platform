import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type OpsModule = {
  key: string;
  name: string;
  category: string;
  description?: string | null;
  ai_enabled: boolean;
  enabled: boolean;
  configured: boolean;
  metadata?: {
    integrations?: string[];
    launch_path?: string;
  };
};

type OpsContextValue = {
  modules: OpsModule[];
  enabledModules: OpsModule[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  updateModule: (key: string, updates: Partial<Pick<OpsModule, 'enabled' | 'configured'>>) => Promise<OpsModule | null>;
};

const OpsContext = createContext<OpsContextValue>({
  modules: [],
  enabledModules: [],
  loading: true,
  error: '',
  refresh: async () => {},
  updateModule: async () => null
});

export const useOps = () => {
  const context = useContext(OpsContext);
  if (!context) {
    throw new Error('useOps must be used within an OpsProvider');
  }
  return context;
};

export const OpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [modules, setModules] = useState<OpsModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token) {
      setModules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/ops/modules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setModules(response.data || []);
    } catch (err) {
      console.error('Failed to load ops modules:', err);
      setError('Unable to load ops modules right now.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateModule = useCallback(async (key: string, updates: Partial<Pick<OpsModule, 'enabled' | 'configured'>>) => {
    if (!token) {
      return null;
    }
    setError('');
    const response = await axios.patch(`${API_URL}/api/ops/modules/${key}`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = response.data;
    setModules((prev) =>
      prev.map((module) => (module.key === key ? { ...module, ...payload } : module))
    );
    return payload;
  }, [token]);

  const enabledModules = useMemo(() => modules.filter((module) => module.enabled), [modules]);

  return (
    <OpsContext.Provider value={{ modules, enabledModules, loading, error, refresh, updateModule }}>
      {children}
    </OpsContext.Provider>
  );
};
