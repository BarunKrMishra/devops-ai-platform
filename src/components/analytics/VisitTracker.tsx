import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Persistent per-browser id so we can count returning visitors (anonymous too).
const getSessionId = (): string => {
  try {
    let id = localStorage.getItem('aikya_sid');
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('aikya_sid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
};

/**
 * Fires a lightweight, fire-and-forget beacon to the backend on every route
 * change. Records anonymous visits; when the user is logged in, the backend
 * links the view to them via the auth header. Failures are ignored silently.
 */
const VisitTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    axios
      .post(`${API_URL}/api/track/view`, {
        path: location.pathname,
        referrer: document.referrer || null,
        sessionId: getSessionId()
      })
      .catch(() => {});
  }, [location.pathname]);

  return null;
};

export default VisitTracker;
