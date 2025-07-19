"use client";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Memoized redirect functions to prevent unnecessary re-renders
  const redirectToHome = useCallback(() => {
    console.log('Landing page - No user, redirecting to /');
    router.replace("/");
  }, [router]);

  const redirectToTutorial = useCallback(() => {
    console.log('Landing page - Tutorial not complete, redirecting to /tutorial');
    router.replace("/tutorial");
  }, [router]);

  const redirectToDashboard = useCallback(() => {
    console.log('Landing page - Tutorial complete, redirecting to /dashboard');
    router.replace("/dashboard");
  }, [router]);

  const forceRedirectToTutorial = useCallback(() => {
    console.log('Landing page - Timeout reached, forcing redirect to tutorial');
    router.push('/tutorial');
  }, [router]);

  // Add a timeout to prevent getting stuck
  useEffect(() => {
    if (user && !profile && !loading) {
      const timer = setTimeout(() => {
        console.log('Landing page - Timeout reached, forcing redirect to tutorial');
        setTimeoutReached(true);
        forceRedirectToTutorial();
      }, 5000); // 5 second timeout
      
      return () => clearTimeout(timer);
    }
  }, [user, profile, loading, forceRedirectToTutorial]);

  useEffect(() => {
    console.log('Landing page - User:', user?.id);
    console.log('Landing page - Profile:', profile);
    console.log('Landing page - Loading:', loading);
    
    if (loading) {
      console.log('Landing page - Still loading...');
      return;
    }
    
    if (!user) {
      redirectToHome();
      return;
    }

    // If we have a profile, check what to do
    if (profile) {
      console.log('Landing page - Profile found:', profile.username, 'tutorial_complete:', profile.tutorial_complete);
      
      // Check if user has a temporary username (OAuth users)
      if (profile.username && profile.username.startsWith('user_')) {
        console.log('Landing page - Temporary username detected:', profile.username);
        setShowUsernamePrompt(true);
        return;
      }

      // Normal flow for users with proper usernames
      if (profile.tutorial_complete === false) {
        redirectToTutorial();
        return;
      }
      if (profile.tutorial_complete === true) {
        redirectToDashboard();
        return;
      }
    } else {
      console.log('Landing page - No profile yet, waiting...');
      // If we've been waiting too long and have a user, redirect to tutorial as fallback
      if (timeoutReached) {
        console.log('Landing page - Timeout reached, redirecting to tutorial');
        forceRedirectToTutorial();
        return;
      }
    }
  }, [user, profile, loading, timeoutReached, redirectToHome, redirectToTutorial, redirectToDashboard, forceRedirectToTutorial]);

  // Show username prompt for OAuth users with temporary usernames
  if (showUsernamePrompt) {
    return <UsernamePrompt />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="text-white text-xl mb-4">Loading...</div>
      {user && !profile && !loading && (
        <div className="text-center">
          <p className="text-white/70 mb-4">Taking longer than expected?</p>
          <button
            onClick={() => router.push('/tutorial')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Continue to Tutorial
          </button>
        </div>
      )}
    </div>
  );
} 