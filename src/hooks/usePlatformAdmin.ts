import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Returns whether the current user is an Aikya platform admin.
 * `null` while loading, then `true` / `false`. Backed by the server allow-list,
 * so this only controls what UI is shown — the API enforces access regardless.
 */
export const usePlatformAdmin = (): boolean | null => {
  const { token } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(null);
    axios
      .get(`${API_URL}/api/platform/access`)
      .then(() => { if (active) setIsAdmin(true); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, [token]);

  return isAdmin;
};
