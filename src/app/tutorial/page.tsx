"use client";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TutorialPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // 0 = username, 1 = tutorial
  const [finishing, setFinishing] = useState(false);

  // If already complete, redirect
  if (!loading && profile && profile.tutorial_complete) {
    router.replace("/dashboard");
    return null;
  }

  // Username step (only if missing)
  const needsUsername = profile && (!profile.username || profile.username.trim() === "");

  const checkUsername = async () => {
    setUsernameChecked(false);
    setUsernameAvailable(false);
    setUsernameError("");
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .single();
    if (error && error.code !== "PGRST116") {
      setUsernameError("Error checking username. Try again.");
      return;
    }
    if (data) {
      setUsernameError("Username is already taken");
      setUsernameChecked(true);
      setUsernameAvailable(false);
    } else {
      setUsernameChecked(true);
      setUsernameAvailable(true);
    }
  };

  const saveUsername = async () => {
    if (!user) return; // Null check
    setSaving(true);
    setUsernameError("");
    const { error } = await supabase
      .from("users")
      .update({ username })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setUsernameError("Failed to save username. Try again.");
    } else {
      setStep(1);
    }
  };

  const finishTutorial = async () => {
    if (!user) return; // Null check
    setFinishing(true);
    await supabase
      .from("users")
      .update({ tutorial_complete: true })
      .eq("id", user.id);
    setFinishing(false);
    router.replace("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">Welcome to Tacto!</h1>
        {loading || !profile ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : needsUsername && step === 0 ? (
          <>
            <h2 className="text-xl font-semibold mb-4 text-center">Choose a Username</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setUsernameChecked(false);
                  setUsernameAvailable(false);
                  setUsernameError("");
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter a username"
                minLength={3}
                maxLength={20}
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={checkUsername}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                  disabled={username.length < 3}
                >
                  Check Username
                </button>
                <button
                  type="button"
                  onClick={saveUsername}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                  disabled={!usernameChecked || !usernameAvailable || saving}
                >
                  {saving ? "Saving..." : "Save Username"}
                </button>
              </div>
              {usernameChecked && usernameAvailable && (
                <div className="text-green-600 text-sm">Username is available!</div>
              )}
              {usernameError && (
                <div className="text-red-600 text-sm">{usernameError}</div>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4 text-center">Tutorial</h2>
            <div className="mb-6 text-gray-700 dark:text-gray-200 text-center">
              <p>This is a placeholder for the interactive tutorial. Here you will learn how to play Tacto!</p>
              <p className="mt-2">(You can expand this with real steps later.)</p>
            </div>
            <button
              type="button"
              onClick={finishTutorial}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              disabled={finishing}
            >
              {finishing ? "Finishing..." : "Finish Tutorial"}
            </button>
          </>
        )}
      </div>
    </div>
  );
} 