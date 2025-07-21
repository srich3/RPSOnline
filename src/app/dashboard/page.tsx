"use client";
import { useAuth } from "../../hooks/useAuth";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";
import ProfileCard from '../../components/user/ProfileCard';
import { StatsOverview } from '../../components/user/StatsOverview';
import QueueManager from '../../components/matchmaking/QueueManager';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useTheme } from '../../components/ThemeProvider';

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const routerRef = useRef(router);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const authProcessed = useRef(false);

  // Update router ref when router changes
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Memoized redirect functions to prevent unnecessary re-renders
  const redirectToHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const redirectToLanding = useCallback(() => {
    router.push("/landing");
  }, [router]);

  useEffect(() => {
    // Skip if we've already processed this exact state
    if (authProcessed.current) {
      return;
    }
    
    // Wait for loading to complete
    if (loading) {
      return;
    }
    
    // Redirect to login if no user
    if (!user) {
      redirectToHome();
      return;
    }
    
    // Redirect to landing if user has temporary username (OAuth users)
    if (profile && profile.username && profile.username.startsWith('user_')) {
      redirectToLanding();
      return;
    }
    
    // If no profile yet, wait a bit
    if (!profile) {
      return;
    }
    
    authProcessed.current = true;
  }, [user, profile, loading, redirectToHome, redirectToLanding]);

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
    // The AuthProvider will handle profile updates
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-[var(--color-fg)] font-bold text-xl">Redirecting to login...</div>
      </div>
    );
  }

  // Show loading state while profile is being loaded
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-[var(--color-fg)] font-bold text-xl">Loading dashboard...</div>
      </div>
    );
  }

  // Show username prompt if user has temporary username
  if (profile.username && profile.username.startsWith('user_')) {
    return <UsernamePrompt />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-[var(--color-bg)] border-b border-[var(--color-dark-soft)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">
                Tacto Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg transition-colors font-semibold bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90"
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
          {/* Main Content: Matchmaking and Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Matchmaking */}
            <QueueManager />
            {/* Quick Actions */}
            <div className="bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90">
                  Join Tournament
                </button>
                <button className="font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90">
                  View Leaderboard
                </button>
                <button className="font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90">
                  Achievements
                </button>
                <button className="font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90">
                  Game History
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