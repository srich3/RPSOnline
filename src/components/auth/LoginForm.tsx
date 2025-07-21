'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { signInWithProvider } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { useTheme } from '../ThemeProvider';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onClose: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { signIn } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/landing');
        }, 1000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError('');
    try {
      const { error } = await signInWithProvider(provider);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('Social login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="rounded-lg shadow-xl p-8 border border-[var(--color-dark-soft)] bg-[var(--color-bg)]"> 
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2 text-[var(--color-fg)]">Welcome Back</h2>
          <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] font-light">Sign in to continue playing Tacto</p>
        </div>
        {success ? (
          <div className="text-green-600 text-center font-semibold text-lg">
            Login successful!<br />
            <span className="text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)] text-sm">Redirecting...</span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-[var(--color-fg)]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color-mix(in_srgb,var(--color-fg)_40%,var(--color-bg)_60%)] h-5 w-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--color-dark-soft)] focus:border-transparent border-[var(--color-dark-soft)] bg-[var(--color-bg)] text-[var(--color-fg)]"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-[var(--color-fg)]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color-mix(in_srgb,var(--color-fg)_40%,var(--color-bg)_60%)] h-5 w-5" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--color-dark-soft)] focus:border-transparent border-[var(--color-dark-soft)] bg-[var(--color-bg)] text-[var(--color-fg)]"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[color-mix(in_srgb,var(--color-fg)_40%,var(--color-bg)_60%)] hover:brightness-90"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border rounded-lg p-3 bg-[var(--color-light-soft)] border-[var(--color-dark-soft)]"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        )}
        {/* Social Login */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-dark-soft)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--color-bg)] text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)]">Or continue with</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="w-full inline-flex justify-center py-2 px-4 border rounded-lg shadow-sm text-sm font-medium transition-colors duration-200 border-[var(--color-dark-soft)] bg-[var(--color-bg)] text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] hover:brightness-90"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="ml-2">Google</span>
            </button>
            <button
              onClick={() => handleSocialLogin('github')}
              disabled={loading}
              className="w-full inline-flex justify-center py-2 px-4 border rounded-lg shadow-sm text-sm font-medium transition-colors duration-200 border-[var(--color-dark-soft)] bg-[var(--color-bg)] text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] hover:brightness-90"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="ml-2">GitHub</span>
            </button>
          </div>
        </div>
        {/* Switch to Signup */}
        <div className="mt-6 text-center">
          <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)]">
            Don&apos;t have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="text-[var(--color-accent)] hover:brightness-90 font-medium"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}; 