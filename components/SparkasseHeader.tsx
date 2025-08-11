"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SparkasseHeader() {
  const pathname = usePathname();
  const isWidgetVersion = pathname === "/";

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


