import React, { useState } from 'react';
import { getApiErrorMessage } from '../../utils/apiError';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // API base URL — same source of truth as the rest of the app (Vite env).
  const getApiBaseUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      let data = null;
      const responseText = await res.text();
      if (responseText && responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error('The server returned an unexpected response. Please try again.');
        }
      }

      if (!res.ok) {
        throw new Error((data && data.error) || 'Unexpected server error');
      }

      if (data?.devMode && data?.devOtp) {
        setSuccess(`OTP sent to your email. (Dev mode OTP: ${data.devOtp})`);
      } else {
        setSuccess('OTP sent to your email.');
      }
      setStep(2);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    const apiBaseUrl = getApiBaseUrl();
    
    const apiUrl = `${apiBaseUrl}/api/auth/verify-otp`;
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        // If not JSON, set generic error
      }
      if (!res.ok) throw new Error((data && data.error) || 'Unexpected server error');
      setSuccess('OTP verified. Please enter your new password.');
      setStep(3);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    const apiBaseUrl = getApiBaseUrl();
    
    const apiUrl = `${apiBaseUrl}/api/auth/reset-password`;
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        // If not JSON, set generic error
      }
      if (!res.ok) throw new Error((data && data.error) || 'Unexpected server error');
      setSuccess('Password reset successful! You can now log in.');
      setStep(4);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-aikya flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-display text-white mb-6 text-center">Forgot Password</h2>

          
          {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-sm">{success}</div>}

          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-lg hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-50">
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="Enter the OTP sent to your email"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-lg hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-lg hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center text-green-300">
              Password reset successful! <a href="/login" className="underline text-teal-300">Go to login</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

