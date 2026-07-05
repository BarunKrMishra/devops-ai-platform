import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const parseFlag = (value?: string) => {
  if (!value) {
    return false;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const envEnabled = parseFlag(import.meta.env.VITE_BILLING_ENABLED);

type BillingStatus = {
  enabled: boolean;
  envEnabled: boolean;
  serverEnabled: boolean;
  currency: string;
  loading: boolean;
  error: string;
};

export const useBillingStatus = () => {
  const { token } = useAuth();
  const [status, setStatus] = useState<BillingStatus>({
    enabled: envEnabled,
    envEnabled,
    serverEnabled: false,
    currency: 'USD',
    loading: true,
    error: ''
  });

  const refresh = useCallback(async () => {
    if (!token) {
      setStatus((prev) => ({
        ...prev,
        enabled: envEnabled,
        envEnabled,
        serverEnabled: false,
        loading: false,
        error: ''
      }));
      return;
    }

    setStatus((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await axios.get(`${API_URL}/api/billing/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const serverEnabled = Boolean(response.data?.enabled);
      const currency = response.data?.currency || 'USD';
      setStatus({
        enabled: envEnabled && serverEnabled,
        envEnabled,
        serverEnabled,
        currency,
        loading: false,
        error: ''
      });
    } catch (error) {
      console.error('Failed to load billing status:', error);
      setStatus((prev) => ({
        ...prev,
        enabled: envEnabled ? false : prev.enabled,
        loading: false,
        error: 'Unable to load billing status.'
      }));
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
};
