"use client";
import { useAuth } from "../../hooks/useAuth";
import { useUserStore } from "../../store/userStore";
import { useEffect, useState } from "react";
import { UsernamePrompt } from "./UsernamePrompt";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
} 