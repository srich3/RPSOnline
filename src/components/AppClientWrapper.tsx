"use client";
import { useAuth } from "../hooks/useAuth";

export function AppClientWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();

  // Wait for profile to load before rendering anything
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
} 