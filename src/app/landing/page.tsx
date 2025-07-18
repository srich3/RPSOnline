"use client";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (profile && profile.tutorial_complete === false) {
      router.replace("/tutorial");
      return;
    }
    if (profile && profile.tutorial_complete === true) {
      router.replace("/dashboard");
      return;
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
} 