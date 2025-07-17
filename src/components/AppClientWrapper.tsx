"use client";
import { useAuth } from "../hooks/useAuth";
import { UsernameGate } from "./user/UsernameGate";

export function AppClientWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <>{children}</>;
  return <UsernameGate>{children}</UsernameGate>;
} 