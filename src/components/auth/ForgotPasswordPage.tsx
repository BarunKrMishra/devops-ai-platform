import React, { useState } from 'react';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    console.log('Sending OTP request for email:', email);
    
    // First, test if the API is reachable
    try {
      const healthCheck = await fetch('/api/health');
      console.log('Health check status:', healthCheck.status);
    } catch (healthError) {
      console.error('Health check failed:', healthError);
      setError('Cannot connect to server. Please check your connection.');
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      let data = null;
      try {
        const responseText = await res.text();
        console.log('Response text:', responseText);
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error('Server returned invalid response format');
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
    try {
      const res = await fetch('/api/auth/verify-otp', {
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
    try {
      const res = await fetch('/api/auth/reset-password', {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Forgot Password</h2>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-xs">
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              {/* Test button in development */}
              {process.env.NODE_ENV === 'development' && (
                <button 
                  type="button" 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/health');
                      const data = await res.json();
                      console.log('Health check result:', data);
                      alert(`Health check: ${res.status} - ${JSON.stringify(data, null, 2)}`);
                    } catch (err: any) {
                      console.error('Health check failed:', err);
                      alert(`Health check failed: ${err.message}`);
                    }
                  }}
                  className="w-full py-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-300 text-sm mb-2"
                >
                  Test API Connection
                </button>
              )}
              
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50">
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Enter the OTP sent to your email"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center text-green-300">
              Password reset successful! <a href="/login" className="underline text-blue-300">Go to login</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage; 