"use client";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UsernamePrompt } from "../../components/user/UsernamePrompt";

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  useEffect(() => {
    console.log('Landing page - User:', user?.id);
    console.log('Landing page - Profile:', profile);
    console.log('Landing page - Loading:', loading);
    
    if (loading) {
      console.log('Landing page - Still loading...');
      return;
    }
    
    if (!user) {
      console.log('Landing page - No user, redirecting to /');
      router.replace("/");
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
        console.log('Landing page - Tutorial not complete, redirecting to /tutorial');
        router.replace("/tutorial");
        return;
      }
      if (profile.tutorial_complete === true) {
        console.log('Landing page - Tutorial complete, redirecting to /dashboard');
        router.replace("/dashboard");
        return;
      }
    } else {
      console.log('Landing page - No profile yet, waiting...');
    }
  }, [user, profile, loading, router]);

  // Show username prompt for OAuth users with temporary usernames
  if (showUsernamePrompt) {
    return <UsernamePrompt />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
} 