"use client";
import { useState, useEffect } from "react";
import { LoginForm } from "../components/auth/LoginForm";
import { SignUpForm } from "../components/auth/SignUpForm";
import { useAuth } from "../hooks/useAuth";
import { useUserStore } from "../store/userStore";
import { useRouter } from "next/navigation";

export default function Home() {
  const [showSignup, setShowSignup] = useState(false);
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading, fetchProfile } = useUserStore();
  const router = useRouter();

  // Fetch profile when user is authenticated
  useEffect(() => {
    if (user && user.id && !profile && !profileLoading) {
      fetchProfile(user.id);
    }
  }, [user, profile, profileLoading, fetchProfile]);

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  // Show loading state while checking authentication
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If user is logged in, show dashboard button
  if (user) {
    const displayName = profile?.username || user.email;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
        <main className="w-full max-w-2xl flex flex-col items-center gap-8 mt-12">
          <h1 className="text-5xl font-extrabold text-white text-center drop-shadow-lg mb-2">
            RPSOnline
          </h1>
          <h2 className="text-2xl text-purple-200 text-center mb-6">
            Multiplayer Rock Paper Scissors – Reimagined
          </h2>
          
          {/* Welcome back section */}
          <div className="w-full bg-white/10 rounded-lg p-8 text-white text-center shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Welcome back, {displayName}!</h3>
            <p className="text-purple-200 mb-6">
              Ready to continue your RPSOnline journey?
            </p>
            <button
              onClick={handleGoToDashboard}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 shadow-lg text-lg"
            >
              Go to Dashboard
            </button>
          </div>

          <div className="mt-8 w-full bg-white/10 rounded-lg p-6 text-white text-center shadow-lg">
            <h3 className="text-xl font-bold mb-2">What is RPSOnline?</h3>
            <p className="mb-2">
              RPSOnline is a modern, competitive twist on the classic Rock Paper Scissors game. Play against friends or match with players worldwide in real time. Climb the leaderboard, earn achievements, and master new strategies!
            </p>
            <ul className="list-disc list-inside text-left mx-auto max-w-md">
              <li>Real-time multiplayer matches</li>
              <li>Skill-based rating and matchmaking</li>
              <li>Unique game board and action system</li>
              <li>Achievements, tournaments, and more coming soon!</li>
            </ul>
          </div>
        </main>
        <footer className="mt-auto py-6 text-purple-200 text-sm text-center">
          &copy; {new Date().getFullYear()} RPSOnline. All rights reserved.
        </footer>
      </div>
    );
  }

  // If user is not logged in, show login/signup forms
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <main className="w-full max-w-2xl flex flex-col items-center gap-8 mt-12">
        <h1 className="text-5xl font-extrabold text-white text-center drop-shadow-lg mb-2">
          RPSOnline
        </h1>
        <h2 className="text-2xl text-purple-200 text-center mb-6">
          Multiplayer Rock Paper Scissors – Reimagined
        </h2>
        <div className="w-full">
          {showSignup ? (
            <SignUpForm
              onSwitchToLogin={() => setShowSignup(false)}
              onClose={() => {}}
            />
          ) : (
            <LoginForm
              onSwitchToSignup={() => setShowSignup(true)}
              onClose={() => {}}
            />
          )}
        </div>
        <div className="mt-8 w-full bg-white/10 rounded-lg p-6 text-white text-center shadow-lg">
          <h3 className="text-xl font-bold mb-2">What is RPSOnline?</h3>
          <p className="mb-2">
            RPSOnline is a modern, competitive twist on the classic Rock Paper Scissors game. Play against friends or match with players worldwide in real time. Climb the leaderboard, earn achievements, and master new strategies!
          </p>
          <ul className="list-disc list-inside text-left mx-auto max-w-md">
            <li>Real-time multiplayer matches</li>
            <li>Skill-based rating and matchmaking</li>
            <li>Unique game board and action system</li>
            <li>Achievements, tournaments, and more coming soon!</li>
          </ul>
        </div>
      </main>
      <footer className="mt-auto py-6 text-purple-200 text-sm text-center">
        &copy; {new Date().getFullYear()} RPSOnline. All rights reserved.
      </footer>
    </div>
  );
}
