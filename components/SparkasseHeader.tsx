"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SparkasseHeader() {
  const pathname = usePathname();
  const isWidgetVersion = pathname === "/";
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");

  // Default: aktuell genutzter Avatar (falls gesetzt), sonst Fallback
  const defaultAvatarId =
    process.env.NEXT_PUBLIC_CUSTOM_AVATAR_ID ?? "Ann_Therapist_public";

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("heygen_selected_avatar_id")
        : null;
    setSelectedAvatarId(stored ?? defaultAvatarId);
  }, [defaultAvatarId]);

  function handleAvatarChange(newId: string) {
    setSelectedAvatarId(newId);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("heygen_selected_avatar_id", newId);
      }
    } catch {}
  }

  return (
    <header className="w-full bg-[#E60000] text-white">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4 font-semibold">
            <span className="text-xl">Sparkasse</span>
            <span className="hidden sm:inline opacity-90">Pforzheim Calw</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm opacity-95">
            <a className="hover:opacity-100 opacity-90" href="#">Produkte</a>
            <a className="hover:opacity-100 opacity-90" href="#">Firmenkunden</a>
            <a className="hover:opacity-100 opacity-90" href="#">Private Banking</a>
            <a className="hover:opacity-100 opacity-90" href="#">Ihre Sparkasse</a>
            <a className="hover:opacity-100 opacity-90" href="#">Karriere</a>
            <a className="hover:opacity-100 opacity-90" href="#">Service-Center</a>
          </nav>
          <div className="flex items-center gap-3">
            {/* Avatar Auswahl */}
            <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded px-2 py-1">
              <label htmlFor="avatar-select" className="text-xs opacity-90">
                Avatar
              </label>
              <select
                id="avatar-select"
                aria-label="Avatar auswählen"
                className="bg-transparent text-white text-sm focus:outline-none"
                value={selectedAvatarId}
                onChange={(e) => handleAvatarChange(e.target.value)}
              >
                <option className="text-black" value={defaultAvatarId}>
                  Alexander (Standard)
                </option>
                <option className="text-black" value="91dff0baa41b48c39d0956efa683ea53">
                  Chiara
                </option>
                <option className="text-black" value="d50cd23ee8e0482aadc2e6b9bf6ee4c8">
                  Moni
                </option>
              </select>
            </div>
            <input
              aria-label="Suche"
              placeholder="Suche"
              className="hidden sm:block px-3 py-1 rounded bg-white/15 placeholder-white/80 text-white text-sm focus:outline-none"
            />
            {/* Version switch button */}
            {isWidgetVersion ? (
              <Link
                className="bg-white/90 hover:bg-white text-[#E60000] text-sm font-semibold rounded px-3 py-1"
                href="/berater"
              >
                Vollversion
              </Link>
            ) : (
              <Link
                className="bg-white/90 hover:bg-white text-[#E60000] text-sm font-semibold rounded px-3 py-1"
                href="/"
              >
                Widget-Version
              </Link>
            )}
            <button className="bg-white text-[#E60000] text-sm font-semibold rounded px-3 py-1">
              Anmelden
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}


