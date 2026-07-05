import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { defaultContent } from '../content/defaultContent';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const STORAGE_KEY = 'aikya_content_v2';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeDeep = (base: unknown, update: unknown): unknown => {
  if (Array.isArray(base)) {
    return Array.isArray(update) ? update : base;
  }

  if (!isObject(base)) {
    return update ?? base;
  }

  const result: Record<string, unknown> = { ...base };
  if (isObject(update)) {
    Object.keys(update).forEach((key) => {
      if (key in base) {
        result[key] = mergeDeep(base[key], update[key]);
      } else {
        result[key] = update[key];
      }
    });
  }
  return result;
};

type ContentState = {
  content: typeof defaultContent;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const ContentContext = createContext<ContentState>({
  content: defaultContent,
  loading: true,
  error: '',
  refresh: async () => {}
});

export const useContent = () => useContext(ContentContext);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrateFromStorage = () => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setContent(mergeDeep(defaultContent, parsed) as typeof defaultContent);
      }
    } catch (storageError) {
      console.warn('Failed to read cached content:', storageError);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/content/app`);
      const nextContent = response.data || defaultContent;
      const merged = mergeDeep(defaultContent, nextContent) as typeof defaultContent;
      setContent(merged);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error('Failed to load content:', err);
      setError('Unable to load content. Using defaults.');
      hydrateFromStorage();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrateFromStorage();
    refresh();
  }, []);

  return (
    <ContentContext.Provider value={{ content, loading, error, refresh }}>
      {children}
    </ContentContext.Provider>
  );
};
