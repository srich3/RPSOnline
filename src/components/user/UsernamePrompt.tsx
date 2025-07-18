"use client";
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { checkUsernameAvailability } from '../../lib/supabase';
import { X, Search, CheckCircle, AlertCircle } from 'lucide-react';

export const UsernamePrompt = () => {
  const { user, updateProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState('');

  // Username validation function
  const validateUsernameFormat = (username: string) => {
    if (!username || username.trim().length === 0) {
      return { valid: false, error: 'Username is required' };
    }
    
    if (username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters long' };
    }
    
    if (username.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }
    
    // Check for allowed characters: letters, numbers, underscores, hyphens
    const validChars = /^[a-zA-Z0-9_-]+$/;
    if (!validChars.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }
    
    // Check for consecutive special characters
    if (/[_-]{2,}/.test(username)) {
      return { valid: false, error: 'Username cannot have consecutive underscores or hyphens' };
    }
    
    // Check for starting/ending with special characters
    if (/^[_-]|[_-]$/.test(username)) {
      return { valid: false, error: 'Username cannot start or end with underscore or hyphen' };
    }
    
    return { valid: true, error: '' };
  };

  const handleCheckUsername = async () => {
    if (!username.trim()) {
      setUsernameError('Please enter a username');
      return;
    }

    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      setUsernameError(formatValidation.error);
      setUsernameAvailable(false);
      setUsernameChecked(true);
      return;
    }

    setCheckingUsername(true);
    setUsernameError('');

    try {
      const { available, error } = await checkUsernameAvailability(username);
      
      if (error) {
        setUsernameError('Error checking username availability');
        setUsernameAvailable(false);
      } else {
        setUsernameAvailable(available);
        setUsernameError(available ? '' : 'Username is already taken');
      }
      setUsernameChecked(true);
    } catch (err) {
      setUsernameError('Error checking username availability');
      setUsernameAvailable(false);
      setUsernameChecked(true);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    
    // Reset validation states when user types
    if (usernameChecked) {
      setUsernameChecked(false);
      setUsernameAvailable(null);
      setUsernameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

    try {
      await updateProfile({ username });
      await refreshProfile();
      
      // Redirect to tutorial
      router.push('/tutorial');
    } catch (err) {
      setError('Failed to update username. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Username
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Pick a unique username to complete your profile
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={username}
                onChange={handleUsernameChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter your username"
                disabled={loading}
              />
              {username && (
                <button
                  type="button"
                  onClick={() => setUsername('')}
                  className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              )}
              <button
                type="button"
                onClick={handleCheckUsername}
                disabled={checkingUsername || !username.trim()}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-1 rounded"
              >
                {checkingUsername ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Username status */}
          {usernameChecked && (
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${
              usernameAvailable === true 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {usernameAvailable === true ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <AlertCircle className="text-red-500" size={20} />
              )}
              <span className={`text-sm ${
                usernameAvailable === true 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {usernameAvailable === true ? 'Username is available!' : usernameError}
              </span>
            </div>
          )}

          {/* Username requirements */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username Requirements:
            </h3>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 3-20 characters long</li>
              <li>• Letters, numbers, underscores, and hyphens only</li>
              <li>• Cannot start or end with special characters</li>
              <li>• No consecutive special characters</li>
              <li>• Must be unique</li>
            </ul>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !usernameChecked || usernameAvailable !== true}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Updating...' : 'Continue to Tutorial'}
          </button>
        </form>
      </div>
    </div>
  );
}; 