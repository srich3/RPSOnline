'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { useTheme } from '../ThemeProvider';

interface SignUpFormProps {
  onSwitchToLogin: () => void;
  onClose: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSwitchToLogin, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { signUp, refreshProfile } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, color: 'gray', text: '' };
    if (password.length < 8) return { strength: 1, color: 'red', text: 'Too short' };
    if (password.length < 10) return { strength: 2, color: 'yellow', text: 'Weak' };
    if (password.length < 12) return { strength: 3, color: 'blue', text: 'Good' };
    return { strength: 4, color: 'green', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    if (!acceptTerms) {
      setError('You must accept the terms of service');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else if (data?.user) {
        const timestamp = Date.now();
        const userIdSuffix = data.user.id.slice(0, 8);
        const tempUsername = `user_${userIdSuffix}_${timestamp}`;
        try {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              username: tempUsername,
              wins: 0,
              losses: 0,
              rating: 100,
              tutorial_complete: false,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (profileError) {
            setError('Account created, but failed to save profile. Please contact support.');
          } else {
            setSuccess(true);
            try {
              await refreshProfile();
            } catch (err) {}
            setTimeout(() => {
              router.push('/landing');
            }, 2000);
          }
        } catch (err) {
          setError('Account created, but failed to save profile. Please contact support.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
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
      <div className={`rounded-lg shadow-xl p-8 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-800'}`}> 
        <div className="text-center mb-8">
          <h2 className={`text-3xl font-bold mb-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>Join Tacto</h2>
          <p className={`${theme === 'light' ? 'text-gray-600 font-light' : 'text-gray-400 font-light'}`}>Create your account to start playing</p>
        </div>
        {success ? (
          <div className="text-green-600 text-center font-semibold text-lg">
            Account created successfully!<br />
            <span className={`${theme === 'light' ? 'text-gray-500' : 'text-gray-400'} text-sm`}>Redirecting...</span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-gray-700 bg-black text-white'}`}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-gray-700 bg-black text-white'}`}
                placeholder="Create a password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex space-x-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-2 flex-1 rounded ${
                        level <= passwordStrength.strength
                          ? passwordStrength.color === 'gray' ? (theme === 'light' ? 'bg-gray-400' : 'bg-gray-600') : `bg-${passwordStrength.color}-500`
                          : theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-sm mt-1 ${
                  passwordStrength.color === 'gray' ? (theme === 'light' ? 'text-gray-400' : 'text-gray-600') : `text-${passwordStrength.color}-600`
                }`}>
                  {passwordStrength.text}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-gray-700 bg-black text-white'}`}
                placeholder="Confirm your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Terms of Service */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                required
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className={`${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>I agree to the{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">Terms of Service</a>{' '}and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">Privacy Policy</a>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`border rounded-lg p-3 ${theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-800'}`}
            >
              <p className={`text-red-600 text-sm`}>{error}</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        )}

        {/* Switch to Login */}
        <div className="mt-6 text-center">
          <p className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}; 