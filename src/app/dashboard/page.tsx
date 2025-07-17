"use client";
import { useAuth } from "../../hooks/useAuth";
import { useUserStore } from "../../store/userStore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { profile, loading, fetchProfile } = useUserStore();
  const router = useRouter();
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  useEffect(() => {
    // Redirect to login if no user
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    // Show profile prompt if user exists but no profile and not loading
    if (user && !profile && !loading) {
      setShowProfilePrompt(true);
    } else {
      setShowProfilePrompt(false);
    }
  }, [user, profile, loading]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleProfileComplete = () => {
    setShowProfilePrompt(false);
    // Refresh the profile
    if (user) {
      fetchProfile(user.id);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Profile Creation Prompt */}
      {showProfilePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4">Complete Your Profile</h3>
            <p className="text-gray-300 mb-4">
              Please choose a username to complete your profile setup.
            </p>
            <UsernamePrompt 
              userId={user.id} 
              onComplete={handleProfileComplete}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white">RPSOnline Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">
                Welcome, {profile?.username || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">User Information</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-sm">Email</label>
                  <p className="text-white">{user.email}</p>
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm">User ID</label>
                  <p className="text-white text-sm font-mono">{user.id}</p>
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm">Profile Status</label>
                  {loading ? (
                    <p className="text-yellow-400">Loading...</p>
                  ) : profile ? (
                    <div>
                      <p className="text-green-400">✓ Profile Found</p>
                      <p className="text-white text-sm">Username: {profile.username}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-400">✗ No Profile Found</p>
                      <button
                        onClick={() => setShowProfilePrompt(true)}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Create Profile
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg">
                  Start New Game
                </button>
                
                <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200">
                  Join Tournament
                </button>
                
                <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200">
                  View Leaderboard
                </button>
                
                <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200">
                  Settings
                </button>
              </div>
            </div>

            {/* Success Message */}
            <div className="mt-6 bg-green-900/20 border border-green-500/50 rounded-xl p-6">
              <h3 className="text-green-400 font-semibold mb-2">✓ Authentication Successful!</h3>
              <p className="text-gray-300">
                You have successfully logged in to RPSOnline. The authentication flow is working correctly.
                {profile ? " Your profile has been loaded successfully." : " You may need to complete your profile setup."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 