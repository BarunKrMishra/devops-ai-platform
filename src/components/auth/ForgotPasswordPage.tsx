import React, { useState } from 'react';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper function to get API base URL
  const getApiBaseUrl = () => {
    return process.env.NODE_ENV === 'production' 
      ? (process.env.VITE_API_URL || 'https://devops-ai-platform.onrender.com')
      : '';
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Get the API base URL from environment variables or use relative path for development
    const apiBaseUrl = getApiBaseUrl();
    
    const apiUrl = `${apiBaseUrl}/api/auth/request-password-reset`;
    
    console.log('Sending OTP request for email:', email);
    console.log('Current window location:', window.location.href);
    console.log('API URL being used:', apiUrl);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('VITE_API_URL:', process.env.VITE_API_URL);
    
    // First, test if the API is reachable
    try {
      const healthUrl = `${apiBaseUrl}/api/health`;
      const healthCheck = await fetch(healthUrl);
      console.log('Health check status:', healthCheck.status);
    } catch (healthError) {
      console.error('Health check failed:', healthError);
      setError('Cannot connect to server. Please check your connection.');
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      let data = null;
      let responseText = '';
      try {
        responseText = await res.text();
        console.log('Response text:', responseText);
        console.log('Response text length:', responseText.length);
        console.log('Response text type:', typeof responseText);
        
        // Check if response is empty
        if (!responseText || responseText.trim() === '') {
          throw new Error('Server returned empty response');
        }
        
        // Try to parse JSON
        data = JSON.parse(responseText);
        console.log('Successfully parsed JSON:', data);
      } catch (parseError: any) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response text that failed to parse:', responseText);
        console.error('Response headers:', Object.fromEntries(res.headers.entries()));
        
        // Try to provide more helpful error message
        if (responseText && responseText.includes('<!DOCTYPE html>')) {
          throw new Error('Server returned HTML instead of JSON. This usually means the server is not running or there is a routing issue.');
        } else if (responseText && responseText.includes('Cannot GET') || responseText.includes('Cannot POST')) {
          throw new Error('API endpoint not found. Please check if the server is running correctly.');
        } else {
          throw new Error(`Server returned invalid response format: ${parseError.message}`);
        }
      }
      
      if (!res.ok) {
        console.error('Server error response:', data);
        throw new Error((data && data.error) || 'Unexpected server error');
      }
      
      console.log('Success response:', data);
      
      if (data.devMode && data.devOtp) {
        setSuccess(`OTP sent to your email. (Dev mode OTP: ${data.devOtp})`);
      } else {
        setSuccess('OTP sent to your email.');
      }
      setStep(2);
    } catch (err: any) {
      console.error('Error in handleRequestOtp:', err);
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-aikya flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-display text-white mb-6 text-center">Forgot Password</h2>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-teal-500/20 border border-teal-500/30 rounded text-teal-300 text-xs">
              <div>Debug Info:</div>
              <div>Step: {step}</div>
              <div>Loading: {loading ? 'Yes' : 'No'}</div>
              <div>Email: {email}</div>
              <div>NODE_ENV: {process.env.NODE_ENV}</div>
              <div>VITE_API_URL: {process.env.VITE_API_URL || 'Not set'}</div>
              <div>Current URL: {window.location.href}</div>
            </div>
          )}
          
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
              
              {/* Test button in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="space-y-2">
                  <button 
                    type="button" 
                    onClick={async () => {
                      try {
                        const apiBaseUrl = getApiBaseUrl();
                        const healthUrl = `${apiBaseUrl}/api/health`;
                        const res = await fetch(healthUrl);
                        const data = await res.json();
                        console.log('Health check result:', data);
                        alert(`Health check: ${res.status} - ${JSON.stringify(data, null, 2)}`);
                      } catch (err: any) {
                        console.error('Health check failed:', err);
                        alert(`Health check failed: ${err.message}`);
                      }
                    }}
                    className="w-full py-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-300 text-sm"
                  >
                    Test API Connection
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={async () => {
                      try {
                        console.log('Testing direct fetch to backend...');
                        const res = await fetch('http://localhost:3001/api/health');
                        const data = await res.json();
                        console.log('Direct health check result:', data);
                        alert(`Direct health check: ${res.status} - ${JSON.stringify(data, null, 2)}`);
                      } catch (err: any) {
                        console.error('Direct health check failed:', err);
                        alert(`Direct health check failed: ${err.message}`);
                      }
                    }}
                    className="w-full py-2 bg-orange-500/20 border border-orange-500/30 rounded text-orange-300 text-sm"
                  >
                    Test Direct Backend
                  </button>
                </div>
              )}
              
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

