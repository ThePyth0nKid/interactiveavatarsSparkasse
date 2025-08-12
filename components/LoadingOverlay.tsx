"use client";

import React from "react";

type LoadingOverlayProps = {
  message?: string;
  subMessage?: string;
};

export default function LoadingOverlay({
  message = "Dein Avatar ist gleich verfügbar",
  subMessage = "Verbindung wird hergestellt…",
}: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 text-white gap-4 select-none">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-700/60" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#E60000] animate-spin" />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold tracking-wide">{message}</div>
        <div className="mt-1 text-sm text-zinc-300 animate-pulse">{subMessage}</div>
      </div>
      <div className="mt-2 flex items-center gap-1" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-white/70 animate-bounce [animation-delay:-0.2s]" />
        <span className="h-2 w-2 rounded-full bg-white/70 animate-bounce" />
        <span className="h-2 w-2 rounded-full bg-white/70 animate-bounce [animation-delay:0.2s]" />
      </div>
      <span className="sr-only" aria-live="polite">
        {message}. {subMessage}
      </span>
    </div>
  );
}


