"use client";
import { useAuth } from "../../hooks/useAuth";
import { useUserStore } from "../../store/userStore";
import { useEffect, useState } from "react";
import { UsernamePrompt } from "./UsernamePrompt";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, fetchProfile, error } = useUserStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    if (
      user &&
      typeof user.id === "string" &&
      user.id.length > 0 &&
      !profile &&
      !profileLoading &&
      !hasAttemptedFetch
    ) {
      setHasAttemptedFetch(true);
      fetchProfile(user.id);
    }
  }, [user, profile, profileLoading, fetchProfile, hasAttemptedFetch]);

  useEffect(() => {
    if (
      user &&
      typeof user.id === "string" &&
      user.id.length > 0 &&
      !profile &&
      !profileLoading &&
      hasAttemptedFetch
    ) {
      // Show prompt if we've attempted to fetch but no profile exists
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
    }
  }, [user, profile, profileLoading, hasAttemptedFetch]);

  if (authLoading || profileLoading) return null;

  // If there's an error but we have a user, show the username prompt instead of error
  if (error && user && user.id) {
    return (
      <>
        <UsernamePrompt userId={user.id} onComplete={() => {
          // Reset the store state and try again
          useUserStore.getState().resetError();
          setHasAttemptedFetch(false);
          setShowPrompt(false);
        }} />
        {children}
      </>
    );
  }

  return (
    <>
      {showPrompt && user && user.id && (
        <UsernamePrompt userId={user.id} onComplete={() => {
          // Reset the store state and try again
          useUserStore.getState().resetError();
          setHasAttemptedFetch(false);
          setShowPrompt(false);
        }} />
      )}
      {children}
    </>
  );
} 