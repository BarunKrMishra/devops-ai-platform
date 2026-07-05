import axios from 'axios';

/**
 * Extracts a user-friendly message from an unknown error thrown by an API call.
 * Prefers the backend-provided `error` field, then the Axios/JS message, then a
 * caller-supplied fallback. Keeps `catch` blocks free of `any`.
 */
export const getApiErrorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.response?.data?.message || err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};
