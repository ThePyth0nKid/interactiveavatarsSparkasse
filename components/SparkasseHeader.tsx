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
        <div className="flex items-center justify-between h-24">
          {/* Links: Sparkasse Logo/Text */}
          <div className="flex items-center font-semibold">
            <span className="text-xl">Sparkasse Pforzheim Calw</span>
          </div>
          
          {/* Zentral: Interactive Avatar Alex Titel */}
          <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
            <h1 className="text-lg lg:text-xl font-bold tracking-wider whitespace-nowrap">
              INTERACTIVE AVATAR ALEX
            </h1>
          </div>
          
          {/* Rechts: Navigation und Buttons */}
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>
    </header>
  );
}


