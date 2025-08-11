"use client";

import React, { useState } from "react";
import InteractiveAvatar from "./InteractiveAvatar";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Chat öffnen"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl bg-white text-[#E60000] border border-black/10 flex items-center justify-center text-xl"
        onClick={() => setOpen((v) => !v)}
      >
        💬
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed z-40 bottom-24 right-6 w-[360px] sm:w-[420px] h-[560px] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-700">
          <div className="flex items-center justify-between px-4 py-2 bg-[#E60000] text-white">
            <span className="font-semibold">Berater-Chat</span>
            <button
              className="text-white/90 hover:text-white"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="h-full">
            <InteractiveAvatar />
          </div>
        </div>
      )}
    </>
  );
}


