"use client";
import { useState, useEffect } from "react";
import { LoginForm } from "../components/auth/LoginForm";
import { SignUpForm } from "../components/auth/SignUpForm";
import { useAuth } from "../hooks/useAuth";
import { useUserStore } from "../store/userStore";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "../components/ThemeToggle";
import { useTheme } from "../components/ThemeProvider";

export default function Home() {
  const [showSignup, setShowSignup] = useState(false);
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading, fetchProfile } = useUserStore();
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch profile when user is authenticated
  useEffect(() => {
    if (user && user.id && !profile && !profileLoading) {
      fetchProfile(user.id);
    }
  }, [user, profile, profileLoading, fetchProfile]);

  const handleGoToDashboard = () => {
    router.push('/landing');
  };

  // Show loading state while checking authentication
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] p-4">
        <div className="text-[var(--color-fg)] text-xl font-bold">Loading...</div>
      </div>
    );
  }

  // If user is logged in, check if they need to go through OAuth flow
  if (user) {
    // Check if this is an OAuth user with a temporary username
    if (profile && profile.username && profile.username.startsWith('user_')) {
      router.push('/landing');
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] p-4">
          <div className="text-[var(--color-fg)] text-xl font-bold">Redirecting...</div>
        </div>
      );
    }
    const displayName = profile?.username || user.email;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] p-4">
        <header className="w-full flex justify-end pt-6 pr-6">
          <ThemeToggle />
        </header>
        <main className="w-full max-w-2xl flex flex-col items-center gap-8 mt-8">
          <h1 className="text-5xl font-extrabold text-center mb-2 text-[var(--color-fg)]">Tacto</h1>
          <h2 className="text-2xl font-bold text-center mb-6 text-[var(--color-fg)]">Tactical Tic Tac Toe – Every Square is a Battle</h2>
          {/* Welcome back section */}
          <div className="w-full bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-lg p-8 text-center shadow-lg">
            <h3 className="text-2xl font-bold mb-4 text-[var(--color-fg)]">Welcome back, {displayName}!</h3>
            <p className="mb-6 text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] font-light">Ready to continue your Tacto journey?</p>
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-[var(--color-dark-soft)] text-[var(--color-light)] font-bold py-4 px-8 rounded-lg transition-all duration-200 shadow-lg text-lg hover:brightness-90"
            >
              Go to Dashboard
            </button>
          </div>
          <div className="mt-8 w-full bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-lg p-6 text-center shadow-lg">
            <h3 className="text-xl font-bold mb-2 text-[var(--color-fg)]">What is Tacto?</h3>
            <p className="mb-2 text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] font-light">
              Tacto is a modern, competitive twist on the classic Tic Tac Toe game. Control the 3x3 grid through strategic allocation of Attack, Defend, and Conquer actions. Every turn is a battle of wits—will you secure key positions, break through enemy defenses, or expand your territory?
            </p>
            <ul className="list-disc list-inside text-left mx-auto max-w-md text-[color-mix(in_srgb,var(--color-fg)_80%,var(--color-bg)_20%)]">
              <li>Real-time multiplayer matches</li>
              <li>Skill-based rating and matchmaking</li>
              <li>Unique game board and action system</li>
              <li>Achievements, tournaments, and more coming soon!</li>
            </ul>
          </div>
        </main>
        <footer className="mt-auto py-6 text-sm text-center text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)]">
          &copy; {new Date().getFullYear()} Tacto. All rights reserved.
        </footer>
      </div>
    );
  }

  // If user is not logged in, show login/signup forms
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)] p-4">
      <header className="w-full flex justify-end pt-6 pr-6">
        <ThemeToggle />
      </header>
      <main className="w-full max-w-2xl flex flex-col items-center gap-8 mt-8">
        <h1 className="text-5xl font-extrabold text-center mb-2 text-[var(--color-fg)]">Tacto</h1>
        <h2 className="text-2xl font-bold text-center mb-6 text-[var(--color-fg)]">Tactical Tic Tac Toe – Every Square is a Battle</h2>
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
        <div className="mt-8 w-full bg-[var(--color-bg)] border border-[var(--color-dark-soft)] rounded-lg p-6 text-center shadow-lg">
          <h3 className="text-xl font-bold mb-2 text-[var(--color-fg)]">What is Tacto?</h3>
          <p className="mb-2 text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] font-light">
            Tacto is a modern, competitive twist on the classic Tic Tac Toe game. Control the 3x3 grid through strategic allocation of Attack, Defend, and Conquer actions. Every turn is a battle of wits—will you secure key positions, break through enemy defenses, or expand your territory?
          </p>
          <ul className="list-disc list-inside text-left mx-auto max-w-md text-[color-mix(in_srgb,var(--color-fg)_80%,var(--color-bg)_20%)]">
            <li>Real-time multiplayer matches</li>
            <li>Skill-based rating and matchmaking</li>
            <li>Unique game board and action system</li>
            <li>Achievements, tournaments, and more coming soon!</li>
          </ul>
        </div>
      </main>
      <footer className="mt-auto py-6 text-sm text-center text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)]">
        &copy; {new Date().getFullYear()} Tacto. All rights reserved.
      </footer>
    </div>
  );
}
