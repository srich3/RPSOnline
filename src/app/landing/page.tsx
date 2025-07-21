"use client";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";
import { useTheme } from "../../components/ThemeProvider";

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const { theme } = useTheme();

  // Memoized redirect functions to prevent unnecessary re-renders
  const redirectToHome = useCallback(() => {
    router.replace("/");
  }, [router]);

  const redirectToTutorial = useCallback(() => {
    router.replace("/tutorial");
  }, [router]);

  const redirectToDashboard = useCallback(() => {
    router.replace("/dashboard");
  }, [router]);

  const forceRedirectToTutorial = useCallback(() => {
    router.push('/tutorial');
  }, [router]);

  useEffect(() => {
    if (user && !profile && !loading) {
      const timer = setTimeout(() => {
        setTimeoutReached(true);
        setLoadingMessage("Taking longer than expected...");
        forceRedirectToTutorial();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, profile, loading, forceRedirectToTutorial]);

  useEffect(() => {
    if (loading) {
      setLoadingMessage("Loading your profile...");
    } else if (user && !profile) {
      setLoadingMessage("Setting up your account...");
    } else if (user && profile) {
      setLoadingMessage("Redirecting...");
    }
  }, [loading, user, profile]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      redirectToHome();
      return;
    }
    if (profile) {
      if (profile.username && profile.username.startsWith('user_')) {
        setShowUsernamePrompt(true);
        return;
      }
      if (profile.tutorial_complete === false) {
        redirectToTutorial();
        return;
      }
      if (profile.tutorial_complete === true) {
        redirectToDashboard();
        return;
      }
    } else {
      if (timeoutReached) {
        forceRedirectToTutorial();
        return;
      }
    }
  }, [user, profile, loading, timeoutReached, redirectToHome, redirectToTutorial, redirectToDashboard, forceRedirectToTutorial]);

  if (showUsernamePrompt) {
    return <UsernamePrompt />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)]">
      <div className="text-xl mb-4 font-bold text-[var(--color-fg)]">{loadingMessage}</div>
      {/* Loading spinner */}
      <div className="w-8 h-8 rounded-full animate-spin mb-4 border-4 border-[var(--color-dark-soft)] border-t-[var(--color-light-soft)]"></div>
      {user && !profile && !loading && (
        <div className="text-center">
          <p className="text-[color-mix(in_srgb,var(--color-fg)_60%,var(--color-bg)_40%)] mb-4">Taking longer than expected?</p>
          <button
            onClick={() => router.push('/tutorial')}
            className="px-6 py-2 rounded-lg font-bold transition-colors bg-[var(--color-dark-soft)] text-[var(--color-light)] hover:brightness-90"
          >
            Continue to Tutorial
          </button>
        </div>
      )}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-[color-mix(in_srgb,var(--color-fg)_50%,var(--color-bg)_50%)] mt-4 text-sm">
          <p>User: {user?.id ? 'Yes' : 'No'}</p>
          <p>Profile: {profile ? 'Yes' : 'No'}</p>
          <p>Loading: {loading ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
} 