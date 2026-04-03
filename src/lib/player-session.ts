"use client";

import { useState, useEffect } from "react";

interface PlayerSession {
  playerId: string;
  guildId: string;
  playerName: string;
}

const STORAGE_KEY = "fguild_player_session";

export function getPlayerSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPlayerSession(session: PlayerSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPlayerSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function usePlayerSession() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getPlayerSession());
    setLoading(false);
  }, []);

  function logout() {
    clearPlayerSession();
    setSession(null);
  }

  return { session, loading, logout };
}
