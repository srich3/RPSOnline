'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, User, Check, X, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { createUserProfile, checkUsernameAvailability, supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

interface SignUpFormProps {
  onSwitchToLogin: () => void;
  onClose: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSwitchToLogin, onClose }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { signUp } = useAuth();
  const router = useRouter();

  // Username validation rules
  const validateUsernameFormat = (username: string): { valid: boolean; error: string } => {
    if (username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters long' };
    }
    if (username.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
    }
    if (username.startsWith('-') || username.endsWith('-') || username.startsWith('_') || username.endsWith('_')) {
      return { valid: false, error: 'Username cannot start or end with hyphens or underscores' };
    }
    if (/--|__|-_|_-/.test(username)) {
      return { valid: false, error: 'Username cannot contain consecutive hyphens or underscores' };
    }
    return { valid: true, error: '' };
  };

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, color: 'gray', text: '' };
    if (password.length < 8) return { strength: 1, color: 'red', text: 'Too short' };
    if (password.length < 10) return { strength: 2, color: 'yellow', text: 'Weak' };
    if (password.length < 12) return { strength: 3, color: 'blue', text: 'Good' };
    return { strength: 4, color: 'green', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(password);

  // Check username availability
  const handleCheckUsername = async () => {
    if (!username.trim()) {
      setUsernameError('Please enter a username');
      return;
    }

    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      setUsernameError(formatValidation.error);
      setUsernameAvailable(false);
      setUsernameChecked(false);
      return;
    }

    setCheckingUsername(true);
    setUsernameError('');
    setUsernameChecked(false);

    try {
      console.log('Checking username availability for:', username);
      const { available, error } = await checkUsernameAvailability(username);
      
      console.log('Username check result:', { available, error });
      
      if (error) {
        console.error('Username check error:', error);
        setUsernameError('Error checking username availability. Please try again.');
        setUsernameAvailable(false);
        setUsernameChecked(false);
      } else {
        setUsernameAvailable(available);
        setUsernameChecked(true);
        if (!available) {
          setUsernameError('Username is already taken');
        }
      }
    } catch (err) {
      console.error('Username check exception:', err);
      setUsernameError('Error checking username availability. Please try again.');
      setUsernameAvailable(false);
      setUsernameChecked(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameChecked(false);
    setUsernameAvailable(null);
    setUsernameError('');
    
    // Clear format errors when user starts typing
    if (value.length > 0) {
      const formatValidation = validateUsernameFormat(value);
      if (formatValidation.valid) {
        setUsernameError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!usernameChecked || usernameAvailable !== true) {
      setError('Please check username availability first');
      setLoading(false);
      return;
    }

    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      setError(formatValidation.error);
      setLoading(false);
      return;
    }

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
        console.log('User created successfully, creating profile with username:', username);
        
        // Create the user profile directly with the username
        try {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              username,
              wins: 0,
              losses: 0,
              rating: 1000,
              tutorial_complete: false,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
            
          if (profileError) {
            console.error('Error creating profile with username:', profileError);
            setError('Account created, but failed to save username. Please contact support.');
          } else {
            console.log('Profile created successfully with username:', username);
            setSuccess(true);
            // Redirect to landing page after a short delay to handle tutorial routing
            setTimeout(() => {
              router.push('/landing');
            }, 2000);
          }
        } catch (err) {
          console.error('Exception creating profile:', err);
          setError('Account created, but failed to save username. Please contact support.');
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Join Tacto
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create your account to start playing
          </p>
        </div>
        {success ? (
          <div className="text-green-600 dark:text-green-400 text-center font-semibold text-lg">
            Account created successfully!<br />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Redirecting...
            </span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Choose a username"
                  required
                  minLength={3}
                  maxLength={20}
                />
              </div>
              
              {/* Check Username Button */}
              <button
                type="button"
                onClick={handleCheckUsername}
                disabled={checkingUsername || !username.trim()}
                className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                {checkingUsername ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Check Username
                  </>
                )}
              </button>
              
              {/* Username Status */}
              {username.length > 0 && (
                <div className="flex items-center space-x-2">
                  {usernameChecked && usernameAvailable === true && (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">Username available</span>
                    </>
                  )}
                  {usernameChecked && usernameAvailable === false && (
                    <>
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">Username taken</span>
                    </>
                  )}
                  {!usernameChecked && username.length >= 3 && (
                    <span className="text-sm text-gray-500">Click "Check Username" to verify availability</span>
                  )}
                </div>
              )}
              
              {/* Username Error */}
              {usernameError && (
                <p className="text-sm text-red-600 dark:text-red-400">{usernameError}</p>
              )}
              
              {/* Username Requirements */}
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>• 3-20 characters long</p>
                <p>• Letters, numbers, hyphens, and underscores only</p>
                <p>• Cannot start or end with hyphens or underscores</p>
                <p>• No consecutive hyphens or underscores</p>
              </div>
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                          ? `bg-${passwordStrength.color}-500`
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-sm mt-1 text-${passwordStrength.color}-600`}>
                  {passwordStrength.text}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-700 dark:text-gray-300">
                I agree to the{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
            >
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !usernameChecked || usernameAvailable !== true}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
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
          <p className="text-gray-600 dark:text-gray-400">
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