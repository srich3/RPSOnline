"use client";
import { useAuth } from "../hooks/useAuth";
import { UsernameGate } from "./user/UsernameGate";

export function AppClientWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  if (!user) return <>{children}</>;
  return <UsernameGate>{children}</UsernameGate>;
} 