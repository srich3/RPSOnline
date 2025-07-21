"use client";
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { checkUsernameAvailability } from '../../lib/supabase';
import { X, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../ThemeProvider';

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
  const { theme } = useTheme();

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
    const validChars = /^[a-zA-Z0-9_-]+$/;
    if (!validChars.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }
    if (/[_-]{2,}/.test(username)) {
      return { valid: false, error: 'Username cannot have consecutive underscores or hyphens' };
    }
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
    <div className={`min-h-screen flex items-center justify-center ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <div className={`rounded-xl shadow-2xl p-8 w-full max-w-md border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-800'}`}>
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold mb-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>Choose Your Username</h1>
          <p className={`${theme === 'light' ? 'text-gray-600 font-light' : 'text-gray-400 font-light'}`}>Pick a unique username to complete your profile</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Username</label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={username}
                onChange={handleUsernameChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-gray-700 bg-black text-white'}`}
                placeholder="Enter your username"
                disabled={loading}
              />
              {username && (
                <button
                  type="button"
                  onClick={() => setUsername('')}
                  className={`absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 ${theme === 'light' ? '' : 'hover:text-gray-300'}`}
                >
                  <X size={20} />
                </button>
              )}
              <button
                type="button"
                onClick={handleCheckUsername}
                disabled={checkingUsername || !username.trim()}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 font-bold p-1 rounded ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}
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
                ? (theme === 'light' ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800')
                : (theme === 'light' ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-800')
            }`}>
              {usernameAvailable === true ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <AlertCircle className="text-red-500" size={20} />
              )}
              <span className={`text-sm ${
                usernameAvailable === true 
                  ? (theme === 'light' ? 'text-green-700' : 'text-green-300')
                  : (theme === 'light' ? 'text-red-700' : 'text-red-300')
              }`}>
                {usernameAvailable === true ? 'Username is available!' : usernameError}
              </span>
            </div>
          )}
          {/* Username requirements */}
          <div className={`${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} rounded-lg p-4`}>
            <h3 className={`text-sm font-medium mb-2 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Username Requirements:</h3>
            <ul className={`text-xs space-y-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              <li>• 3-20 characters long</li>
              <li>• Letters, numbers, underscores, and hyphens only</li>
              <li>• Cannot start or end with special characters</li>
              <li>• No consecutive special characters</li>
              <li>• Must be unique</li>
            </ul>
          </div>
          {/* Error message */}
          {error && (
            <div className={`border rounded-lg p-3 ${theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-800'}`}>
              <p className={`text-sm ${theme === 'light' ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
            </div>
          )}
          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !usernameChecked || usernameAvailable !== true}
            className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}
          >
            {loading ? 'Updating...' : 'Continue to Tutorial'}
          </button>
        </form>
      </div>
    </div>
  );
}; 