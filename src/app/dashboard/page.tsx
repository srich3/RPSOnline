"use client";
import { useAuth } from "../../hooks/useAuth";
import { useUserStore } from "../../store/userStore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";
import ProfileCard from '../../components/user/ProfileCard';
import StatsOverview from '../../components/user/StatsOverview';

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


  const handleLogout = async () => {
    try {
      console.log('Dashboard: Initiating logout...');
      await signOut();
      // The AuthProvider will handle the redirect and page refresh
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback: redirect to home page
      router.push("/");
    }
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


      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white">Tacto Dashboard</h1>
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
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <ProfileCard />
          </div>

          {/* Main Content: Quick Actions and Stats */}
          <div className="lg:col-span-2 space-y-6">
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
                  Achievements
                </button>
              </div>
            </div>
            {/* Stats Overview */}
            <StatsOverview />
          </div>
        </div>
      </main>
    </div>
  );
}  