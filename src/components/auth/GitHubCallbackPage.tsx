import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AikyaLogo from '../brand/AikyaLogo';

const GitHubCallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithGitHub } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    if (oauthError) {
      setError('GitHub login was cancelled or failed.');
      return;
    }

    const storedState = sessionStorage.getItem('github_oauth_state');
    if (!code || !state || state !== storedState) {
      setError('GitHub OAuth validation failed. Please try again.');
      return;
    }

    sessionStorage.removeItem('github_oauth_state');

    const redirectUri = `${window.location.origin}/auth/github/callback`;
    loginWithGitHub(code, redirectUri)
      .then(() => navigate('/dashboard'))
      .catch((err) => {
        setError(err.message || 'GitHub authentication failed.');
      });
  }, [location.search, loginWithGitHub, navigate]);

  return (
    <div className="min-h-screen bg-aikya flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center glass rounded-2xl p-8">
        <AikyaLogo className="justify-center" showText={false} markClassName="h-12 w-12" />
        <h1 className="text-2xl font-display text-white mt-4">Signing you in</h1>
        <p className="text-slate-300 mt-2">Finishing your GitHub connection...</p>
        {error && <p className="text-red-300 mt-4">{error}</p>}
        {error && (
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all"
          >
            Back to login
          </button>
        )}
      </div>
    </div>
  );
};

export default GitHubCallbackPage;
