import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Bot, Github, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'email' | null>(null);
  const [info, setInfo] = useState('');
  const [registrationStep, setRegistrationStep] = useState<'form' | 'otp'>('form');
  
  const { login, register, loginWithGitHub } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Password validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await login(email, password, twoFactorToken);
      } else {
        if (registrationStep === 'form') {
          // First step: create pending user, send OTP
          await register(email, password, 'developer');
        } else {
          // Second step: verify OTP and activate user
          await register(email, password, 'developer', twoFactorToken);
        }
      }
    } catch (err: any) {
      // Check for backend 2FA/OTP responses
      if (
        err.message &&
        (err.message.includes('2FA required') ||
          err.message.includes('OTP sent to email') ||
          err.message.includes('OTP sent to email to complete registration'))
      ) {
        setShow2FA(true);
        setRegistrationStep('otp');
        // Try to detect method from error message or backend response
        if (err.message.includes('email')) {
          setTwoFAMethod('email');
          setInfo('Enter the code sent to your email to complete registration.');
        } else {
          setTwoFAMethod('totp');
          setInfo('Enter the code from your authenticator app.');
        }
        setError('');
      } else if (
        registrationStep === 'otp' &&
        err.message &&
        err.message.toLowerCase().includes('user already exists')
      ) {
        setError('Registration already completed or OTP expired. Please try logging in.');
        setShow2FA(false);
        setRegistrationStep('form');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // In production, redirect to GitHub OAuth
      await loginWithGitHub('demo-code');
    } catch (err) {
      setError('GitHub authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
                <Bot className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-400">
              {isLogin ? 'Sign in to your DevOps AI account' : 'Join the AI-powered DevOps revolution'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="Enter your password (min. 8 characters)"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {!isLogin && (
                <p className="mt-2 text-sm text-gray-400">
                  Password must be at least 8 characters long
                </p>
              )}
            </div>

            {show2FA && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {twoFAMethod === 'email' ? 'Email OTP' : '2FA Code'}
                </label>
                <input
                  type="text"
                  value={twoFactorToken}
                  onChange={e => setTwoFactorToken(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder={twoFAMethod === 'email' ? 'Enter the code sent to your email' : 'Enter 2FA code'}
                  required
                />
                {info && <div className="mt-2 text-sm text-blue-300">{info}</div>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (
                isLogin ? 'Sign In' : (
                  show2FA ? 'Complete Registration' : 'Create Account'
                )
              )}
            </button>

            {isLogin && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-sm text-blue-300 hover:underline"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGitHubLogin}
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center space-x-2 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              <Github className="h-5 w-5" />
              <span>GitHub</span>
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;